"use client";

import { useEffect, useRef, useState } from "react";
import { getHealth, synthesizeSpeech, transcribeAudio } from "@/lib/api";
import { PcmRecorder, type RecorderAudioMetrics, type RecorderStartupMetrics } from "@/lib/recorder";
import type { HealthStatus, STTResponse, TTSResponse } from "@/lib/types";
import { Chip, Metric, Panel, ServiceChip } from "@/components/ui";

const VOICES = [
  "female_north",
  "female_north_ngochoa",
  "female_central",
  "female_south",
  "male_north",
  "male_central",
  "male_south",
];

const MIC_RESTART_SECONDS = 3;

type RecorderState = "idle" | "starting" | "recording" | "transcribing";

function formatMs(value: number | null | undefined): string {
  return typeof value === "number" ? `${value} ms` : "-";
}

function formatConfidence(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value >= 0 && value <= 1) return `${Math.round(value * 100)}%`;
  if (value > 1 && value <= 100) return `${Math.round(value)}%`;
  return `raw ${value.toFixed(2)}`;
}

function waitForMicRestartCountdown(
  onTick: (remainingSeconds: number) => void,
  onTimer: (timer: number | null) => void,
  seconds = MIC_RESTART_SECONDS,
): Promise<void> {
  onTick(seconds);
  return new Promise((resolve) => {
    let remaining = seconds;
    const timer = window.setInterval(() => {
      remaining -= 1;
      onTick(Math.max(remaining, 0));
      if (remaining <= 0) {
        window.clearInterval(timer);
        onTimer(null);
        resolve();
      }
    }, 1000);
    onTimer(timer);
  });
}

export default function SmartVoicePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // STT
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [restartRemainingSeconds, setRestartRemainingSeconds] = useState(MIC_RESTART_SECONDS);
  const [sttResult, setSttResult] = useState<STTResponse | null>(null);
  const [sttLatencyMs, setSttLatencyMs] = useState<number | null>(null);
  const [recorderStartup, setRecorderStartup] = useState<RecorderStartupMetrics | null>(null);
  const [audioMetrics, setAudioMetrics] = useState<RecorderAudioMetrics | null>(null);
  const [wavEncodeMs, setWavEncodeMs] = useState<number | null>(null);
  const [sttRoundTripMs, setSttRoundTripMs] = useState<number | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  // TTS
  const [ttsText, setTtsText] = useState("Bác đến phòng A303 để lấy máu.");
  const [ttsVoice, setTtsVoice] = useState("female_north");
  const [ttsResult, setTtsResult] = useState<TTSResponse | null>(null);
  const [ttsAudioSrc, setTtsAudioSrc] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    return () => {
      if (restartTimerRef.current !== null) window.clearInterval(restartTimerRef.current);
      void recorderRef.current?.stop();
    };
  }, []);

  async function startRecording() {
    if (recorderState !== "idle") return;
    setRecorderState("starting");
    if (restartTimerRef.current !== null) window.clearInterval(restartTimerRef.current);
    setRestartRemainingSeconds(MIC_RESTART_SECONDS);
    setSttError(null);
    setSttResult(null);
    setRecorderStartup(null);
    setAudioMetrics(null);
    setWavEncodeMs(null);
    setSttRoundTripMs(null);
    setSttLatencyMs(null);
    try {
      const clickedAt = performance.now();
      const recorder = await PcmRecorder.create(clickedAt);
      recorderRef.current = recorder;
      recorder.start();
      await recorder.waitUntilReady();
      const startup = recorder.getStartupMetrics();
      setRecorderStartup(startup);
      if (startup) console.table(startup);
      await waitForMicRestartCountdown(
        setRestartRemainingSeconds,
        (timer) => {
          restartTimerRef.current = timer;
        },
        MIC_RESTART_SECONDS,
      );
      setRecorderState("recording");
    } catch (caught) {
      if (restartTimerRef.current !== null) window.clearInterval(restartTimerRef.current);
      restartTimerRef.current = null;
      setSttError(caught instanceof Error ? caught.message : "Không mở được microphone.");
      setRecorderState("idle");
    }
  }

  async function stopAndTranscribe() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setRecorderState("transcribing");
    setSttError(null);
    const stopStartedAt = performance.now();
    try {
      const encodeStartedAt = performance.now();
      const wav = await recorder.stop();
      setAudioMetrics(recorder.getAudioMetrics());
      const encodedAt = performance.now();
      setWavEncodeMs(Math.round(encodedAt - encodeStartedAt));
      recorderRef.current = null;
      const sttStartedAt = performance.now();
      const result = await transcribeAudio(wav);
      setSttRoundTripMs(Math.round(performance.now() - sttStartedAt));
      setSttResult(result);
      setSttLatencyMs(Math.round(performance.now() - stopStartedAt));
    } catch (caught) {
      setSttError(caught instanceof Error ? caught.message : "Không nhận dạng được giọng nói.");
    } finally {
      setRecorderState("idle");
    }
  }

  function playAudio() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  }

  async function runTts() {
    if (!ttsText.trim()) {
      setTtsError("Nhập văn bản trước khi phát audio.");
      return;
    }
    setTtsBusy(true);
    setTtsError(null);
    try {
      const result = await synthesizeSpeech(ttsText, ttsVoice);
      setTtsResult(result);
      setTtsAudioSrc(`data:${result.media_type};base64,${result.audio_base64}`);
      window.setTimeout(() => {
        audioRef.current?.load();
        playAudio();
      }, 0);
    } catch (caught) {
      setTtsError(caught instanceof Error ? caught.message : "TTS thất bại");
    } finally {
      setTtsBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>SmartVoice · STT + TTS</h2>
          <div className="sub">Giọng nói bệnh nhân ⇄ văn bản chỉ đường</div>
        </div>
        <div className="topbar-right">
          {health ? (
            <ServiceChip real={health.services.smartvoice_stt.real && health.services.smartvoice_tts.real} />
          ) : (
            <Chip variant="neutral">Đang kiểm tra…</Chip>
          )}
        </div>
      </div>

      <div className="content">
        <div className="grid-2">
          <Panel
            eyebrow="Giọng nói → Văn bản"
            title="/stt-service/v1/grpc/standard"
            action={<Chip variant="neutral">mô hình: online</Chip>}
          >
            <div className="mic-wrap">
              <button
                className={`mic-btn${recorderState === "recording" ? " recording" : ""}`}
                onClick={recorderState === "recording" ? stopAndTranscribe : startRecording}
                disabled={recorderState === "starting" || recorderState === "transcribing"}
                aria-label={recorderState === "recording" ? "Dừng ghi âm" : "Ghi âm"}
              >
                {recorderState === "starting" ? restartRemainingSeconds : recorderState === "recording" ? "■" : "●"}
              </button>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {recorderState === "starting"
                  ? `Restart hệ thống: ${restartRemainingSeconds}s. Chưa nói vào micro.`
                  : recorderState === "recording"
                  ? "Đang ghi âm…"
                  : recorderState === "transcribing"
                    ? "Đang gửi âm thanh sang SmartVoice…"
                    : "Bấm để ghi âm câu hỏi thử nghiệm"}
              </div>
            </div>
            <div className="transcript-box">{sttResult?.text || (sttError ? "" : "Chưa có bản ghi")}</div>
            {sttError ? <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8 }}>{sttError}</p> : null}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Mic startup latency</div>
              <div className="grid-3">
                <Metric label="Click to ready" value={formatMs(recorderStartup?.mic_ready_ms)} small />
                <Metric label="getUserMedia" value={formatMs(recorderStartup?.get_user_media_ms)} small />
                <Metric label="Start to frame" value={formatMs(recorderStartup?.start_to_first_audio_frame_ms)} small />
                <Metric label="Start to ready" value={formatMs(recorderStartup?.start_to_ready_ms)} small />
                <Metric label="Ready source" value={recorderStartup ? (recorderStartup.ready_by_timeout ? "Timeout" : "Audio frame") : "-"} small />
                <Metric label="Buffer" value={recorderStartup ? `${recorderStartup.buffer_size} @ ${recorderStartup.sample_rate} Hz` : "-"} small />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Captured audio</div>
              <div className="grid-3">
                <Metric label="Captured duration" value={formatMs(audioMetrics?.captured_duration_ms)} small />
                <Metric label="WAV duration" value={formatMs(audioMetrics?.wav_duration_ms)} small />
                <Metric label="Frame to stop" value={formatMs(audioMetrics?.first_audio_frame_to_stop_ms)} small />
                <Metric label="Client trim" value={audioMetrics ? (audioMetrics.silence_trim_applied ? "On" : "Off") : "-"} small />
                <Metric label="Samples" value={audioMetrics ? String(audioMetrics.samples) : "-"} small />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>STT request latency</div>
              <div className="grid-3">
                <Metric label="Stop to text" value={formatMs(sttLatencyMs)} small />
                <Metric label="WAV encode" value={formatMs(wavEncodeMs)} small />
                <Metric label="Frontend /stt" value={formatMs(sttRoundTripMs)} small />
                <Metric label="Backend total" value={formatMs(sttResult?.timing?.total_ms)} small />
                <Metric label="Backend read" value={formatMs(sttResult?.timing?.request_read_ms)} small />
                <Metric label="Backend preprocess" value={formatMs(sttResult?.timing?.preprocessing_ms)} small />
                <Metric label="Backend adapter" value={formatMs(sttResult?.timing?.adapter_ms)} small />
              </div>
            </div>
            <div className="grid-3" style={{ marginTop: 14 }}>
              <Metric label="Độ trễ" value={sttLatencyMs !== null ? `${sttLatencyMs} ms` : "-"} small />
              <Metric label="Độ tin cậy" value={formatConfidence(sttResult?.confidence)} small />
              <Metric label="Tiền xử lý VAD" value={sttResult?.preprocess.vad_applied ? "Bật" : "Tắt"} small />
            </div>
          </Panel>

          <Panel eyebrow="Văn bản → Giọng nói" title="/tts-service/v2/standard">
            <div className="field">
              <label>Văn bản cần đọc</label>
              <textarea rows={3} value={ttsText} onChange={(event) => setTtsText(event.target.value)} />
            </div>
            <div style={{ margin: "14px 0 6px", fontSize: 12.5, fontWeight: 700 }}>Giọng đọc</div>
            <div className="btn-row" style={{ marginBottom: 16 }}>
              {VOICES.map((voice) => (
                <button
                  key={voice}
                  className={`voice-chip${voice === ttsVoice ? " selected" : ""}`}
                  onClick={() => setTtsVoice(voice)}
                >
                  {voice}
                </button>
              ))}
            </div>
            <div className="btn-row" style={{ marginBottom: 14 }}>
              <button className="btn btn-primary" onClick={runTts} disabled={ttsBusy}>
                {ttsBusy ? "Đang tạo…" : "Tạo & nghe thử"}
              </button>
              <button className="btn btn-secondary" onClick={playAudio} disabled={!ttsAudioSrc}>
                Nghe lại
              </button>
              <a
                className="btn btn-secondary"
                href={ttsAudioSrc ?? "#"}
                download={ttsAudioSrc ? "tts.wav" : undefined}
                aria-disabled={!ttsAudioSrc}
                style={!ttsAudioSrc ? { pointerEvents: "none", opacity: 0.4 } : undefined}
              >
                Tải file .wav
              </a>
            </div>
            <audio ref={audioRef} controls src={ttsAudioSrc ?? undefined} style={{ width: "100%", marginBottom: 14 }} />
            <div className="grid-2">
              <Metric label="Tần số mẫu" value={ttsResult ? `${ttsResult.sample_rate} Hz` : "-"} small />
              <Metric label="Định dạng" value={ttsResult ? ttsResult.media_type : "-"} small />
            </div>
            {ttsError ? <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8 }}>{ttsError}</p> : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
