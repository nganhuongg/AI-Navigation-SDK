"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  sendChatMessage,
  transcribeAudio,
  type ChatbotMessageResponse,
  type SmartBotCard,
  type STTResponse,
} from "@/lib/api";
import ReadAloudButton from "@/components/ReadAloudButton";
import { useDemo } from "@/context/demo";

type RecorderState = "idle" | "starting" | "recording" | "transcribing" | "asking";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: string;
  fallback?: boolean;
  cards?: SmartBotCard[];
};

const MIC_SAFE_WINDOW_MS = 3000;

function waitForMicSafeWindow(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, MIC_SAFE_WINDOW_MS));
}

export default function VoiceQuestionPanel() {
  const { session } = useDemo();
  const [state, setState] = useState<RecorderState>("idle");
  const [draft, setDraft] = useState("");
  const [sttResult, setSttResult] = useState<STTResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Chào bác, bác có thể hỏi bước tiếp theo, số phòng cần đến, hoặc cách di chuyển trong bệnh viện.",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, state]);

  async function startRecording() {
    if (state !== "idle") return;
    setState("starting");
    setError(null);
    setSttResult(null);
    try {
      const recorder = await PcmRecorder.create();
      recorderRef.current = recorder;
      recorder.start();
      await recorder.waitUntilReady();
      await waitForMicSafeWindow();
      setState("recording");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không mở được microphone.");
      setState("idle");
    }
  }

  async function stopAndTranscribe() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setState("transcribing");
    setError(null);
    try {
      const wav = await recorder.stop();
      recorderRef.current = null;
      const result = await transcribeAudio(wav);
      setSttResult(result);
      setDraft(result.text);
      if (!result.text.trim()) {
        setError("SmartVoice chưa nhận ra nội dung. Bác thử nói rõ hơn hoặc nhập câu hỏi bằng bàn phím.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không nhận dạng được giọng nói.");
    } finally {
      setState("idle");
    }
  }

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || state !== "idle") return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: message,
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setState("asking");
    setError(null);
    try {
      const result = await sendChatMessage(message, {
        session_id: session?.session_id,
        sender_id: session?.session_id,
        metadata: {
          current_step: session?.journey.current_step,
          target_room: session?.next_action.target_room,
          next_action: session?.next_action.message,
          accessibility_mode: "normal",
        },
      });
      setMessages((current) => [...current, toAssistantMessage(result)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được câu hỏi.");
    } finally {
      setState("idle");
    }
  }

  const isBusy = state === "starting" || state === "transcribing" || state === "asking";

  return (
    <section className="flex min-h-full flex-col gap-4">
      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">SmartBot chat</h2>
            <p className="text-xs text-gray-500">Hỏi đáp theo session và hành trình hiện tại</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hospital-green-light text-hospital-green">
            <ChatIcon />
          </div>
        </div>
        <div className="flex max-h-[360px] min-h-72 flex-col gap-3 overflow-y-auto p-3">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {state === "asking" ? (
            <ChatBubble
              message={{
                id: "typing",
                role: "assistant",
                text: "Đang kiểm tra quy trình bệnh viện...",
              }}
            />
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {sttResult ? <PreprocessSummary result={sttResult} /> : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={submitQuestion} className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tôi vừa khám xong thì đi đâu?"
          className="min-h-20 w-full resize-none rounded-lg bg-gray-50 px-3 py-2 text-base leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
          disabled={state === "recording" || isBusy}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              void submitQuestion(event);
            }
          }}
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={state === "recording" ? stopAndTranscribe : startRecording}
            disabled={isBusy}
            className={`flex min-h-14 w-16 flex-shrink-0 items-center justify-center rounded-xl text-white transition active:scale-[0.98] disabled:opacity-50 ${
              state === "recording" ? "bg-red-600" : "bg-hospital-green"
            }`}
            aria-label={recordButtonLabel(state)}
            title={recordButtonLabel(state)}
          >
            {state === "recording" ? <StopIcon /> : <MicIcon />}
          </button>
          <button
            type="submit"
            disabled={isBusy || state === "recording" || !draft.trim()}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-base font-bold text-white disabled:opacity-40"
          >
            <SendIcon />
            {state === "asking" ? "Đang gửi..." : "Gửi"}
          </button>
        </div>

        <p className="mt-3 min-h-5 text-center text-sm font-semibold text-gray-500">{helperText(state)}</p>
      </form>
    </section>
  );
}

function toAssistantMessage(result: ChatbotMessageResponse): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: result.reply_text,
    fallback: result.handoff_required,
    meta: result.intent_name ? `Intent: ${result.intent_name}` : undefined,
    cards: result.cards,
  };
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-br-md bg-hospital-green text-white"
            : message.fallback
              ? "rounded-bl-md border border-amber-200 bg-amber-50 text-gray-900"
              : "rounded-bl-md bg-gray-100 text-gray-900"
        }`}
      >
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-relaxed">{message.text}</p>
          {!isUser ? <ReadAloudButton text={message.text} label="câu trả lời" /> : null}
        </div>
        {!isUser && message.cards ? <SmartBotCardExtras cards={message.cards} /> : null}
        {message.meta ? (
          <p className={`mt-2 text-xs ${isUser ? "text-white/70" : "text-gray-500"}`}>{message.meta}</p>
        ) : null}
      </div>
    </div>
  );
}

function SmartBotCardExtras({ cards }: { cards: SmartBotCard[] }) {
  const buttons = cards.flatMap((card) => (Array.isArray(card.buttons) ? card.buttons : []));
  const audioCards = cards.filter(
    (card) =>
      typeof card.audio_url === "string" &&
      (card.play_type === "audio" || card.play_type === "both"),
  );

  if (buttons.length === 0 && audioCards.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {buttons.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {buttons.map((button, index) => (
            <button
              key={`${buttonLabel(button)}-${index}`}
              type="button"
              className="min-h-10 rounded-lg border border-hospital-green/30 bg-white px-3 text-sm font-semibold text-hospital-green"
            >
              {buttonLabel(button)}
            </button>
          ))}
        </div>
      ) : null}
      {audioCards.map((card) => (
        <audio key={card.audio_url} controls src={card.audio_url} className="w-full" />
      ))}
    </div>
  );
}

function buttonLabel(button: Record<string, unknown>): string {
  const value = button.title || button.text || button.label || button.name;
  return typeof value === "string" && value.trim() ? value : "Chọn";
}

function PreprocessSummary({ result }: { result: STTResponse }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-800">Xử lý âm thanh</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <Metric label="VAD" value={result.preprocess.vad_applied ? "Có" : "Không"} />
        <Metric label="Noise" value={result.preprocess.denoise_applied ? "Có" : "Không"} />
        <Metric label="Hz" value={`${result.preprocess.output_sample_rate || "-"}`} />
        <Metric label="Đoạn" value={`${result.preprocess.speech_segments}`} />
      </div>
      {result.preprocess.engines.length > 0 ? (
        <p className="mt-2 text-xs text-gray-500">Engine: {result.preprocess.engines.join(", ")}</p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
      <p className="text-[10px] font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-0.5 font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function recordButtonLabel(state: RecorderState): string {
  if (state === "starting") return "Đang mở mic";
  if (state === "recording") return "Dừng ghi âm";
  if (state === "transcribing") return "Đang nhận dạng";
  return "Ghi âm";
}

function helperText(state: RecorderState): string {
  if (state === "starting") return "Chờ nút chuyển sang màu đỏ rồi hãy nói.";
  if (state === "recording") return "Đang ghi âm, bác nói câu hỏi bây giờ.";
  if (state === "transcribing") return "Đang gửi âm thanh sang SmartVoice.";
  return "";
}

class PcmRecorder {
  private context: AudioContext;
  private stream: MediaStream;
  private source: MediaStreamAudioSourceNode;
  private processor: ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private readyPromise: Promise<void>;
  private markReady: () => void = () => undefined;
  private hasAudioFrame = false;

  private constructor(context: AudioContext, stream: MediaStream) {
    this.context = context;
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    this.processor = context.createScriptProcessor(4096, 1, 1);
    this.readyPromise = new Promise((resolve) => {
      this.markReady = resolve;
    });
    this.processor.onaudioprocess = (event) => {
      if (!this.hasAudioFrame) {
        this.hasAudioFrame = true;
        this.markReady();
      }
      const channel = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channel));
    };
  }

  static async create(): Promise<PcmRecorder> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ ghi âm microphone.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    return new PcmRecorder(context, stream);
  }

  start() {
    void this.context.resume();
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async waitUntilReady(): Promise<void> {
    await Promise.race([this.readyPromise, new Promise<void>((resolve) => window.setTimeout(resolve, 900))]);
  }

  async stop(): Promise<Blob> {
    this.processor.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((track) => track.stop());
    const sampleRate = this.context.sampleRate;
    await this.context.close();
    const samples = mergeChunks(this.chunks);
    const trimmed = trimSilence(samples);
    return encodeWav(trimmed.length > 0 ? trimmed : samples, sampleRate);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function trimSilence(samples: Float32Array): Float32Array {
  const threshold = 0.012;
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start += 1;
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1;
  const padding = 1600;
  return samples.slice(Math.max(0, start - padding), Math.min(samples.length, end + padding));
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-12 0v1.5a6 6 0 006 6zm0 0v3m-3 0h6M12 15a3 3 0 003-3V5.25a3 3 0 10-6 0V12a3 3 0 003 3z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L6 12Zm0 0h7.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.75h6M21 12c0 4.142-4.03 7.5-9 7.5a10.8 10.8 0 0 1-3.795-.682L3 20.25l1.432-3.58A6.937 6.937 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z" />
    </svg>
  );
}
