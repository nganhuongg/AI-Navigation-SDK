"use client";

import { useEffect, useRef, useState } from "react";
import { getHealth, synthesizeSpeech, transcribeAudio } from "@/lib/api";
import { PcmRecorder } from "@/lib/recorder";
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

type RecorderState = "idle" | "recording" | "transcribing";

export default function SmartVoicePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // STT
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [sttResult, setSttResult] = useState<STTResponse | null>(null);
  const [sttLatencyMs, setSttLatencyMs] = useState<number | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);

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
      void recorderRef.current?.stop();
    };
  }, []);

  async function startRecording() {
    if (recorderState !== "idle") return;
    setSttError(null);
    setSttResult(null);
    try {
      const recorder = await PcmRecorder.create();
      recorderRef.current = recorder;
      recorder.start();
      await recorder.waitUntilReady();
      setRecorderState("recording");
    } catch (caught) {
      setSttError(caught instanceof Error ? caught.message : "Không mở được microphone.");
      setRecorderState("idle");
    }
  }

  async function stopAndTranscribe() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setRecorderState("transcribing");
    setSttError(null);
    const startedAt = performance.now();
    try {
      const wav = await recorder.stop();
      recorderRef.current = null;
      const result = await transcribeAudio(wav);
      setSttResult(result);
      setSttLatencyMs(Math.round(performance.now() - startedAt));
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
                disabled={recorderState === "transcribing"}
                aria-label={recorderState === "recording" ? "Dừng ghi âm" : "Ghi âm"}
              >
                {recorderState === "recording" ? "■" : "●"}
              </button>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {recorderState === "recording"
                  ? "Đang ghi âm…"
                  : recorderState === "transcribing"
                    ? "Đang gửi âm thanh sang SmartVoice…"
                    : "Bấm để ghi âm câu hỏi thử nghiệm"}
              </div>
            </div>
            <div className="transcript-box">{sttResult?.text || (sttError ? "" : "Chưa có bản ghi")}</div>
            {sttError ? <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8 }}>{sttError}</p> : null}
            <div className="grid-3" style={{ marginTop: 14 }}>
              <Metric label="Độ trễ" value={sttLatencyMs !== null ? `${sttLatencyMs} ms` : "-"} small />
              <Metric label="Độ tin cậy" value={sttResult ? `${Math.round(sttResult.confidence * 100)}%` : "-"} small />
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
