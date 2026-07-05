"use client";

import { useEffect, useRef, useState } from "react";
import { getHealth, sendChatMessage, transcribeAudio } from "@/lib/api";
import { PcmRecorder } from "@/lib/recorder";
import type { ChatbotMessageResponse, HealthStatus } from "@/lib/types";
import { Chip, EmptyState, Kv, Panel, ServiceChip } from "@/components/ui";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  fallback?: boolean;
};

const SAMPLE_QUESTIONS = [
  "Tôi đi thử máu ở đâu?",
  "Tôi đau ngực uống thuốc gì?",
  "Quầy đăng ký khám ở đâu?",
];

export default function SmartBotPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [sessionId] = useState(() => `admin_test_${Math.random().toString(36).slice(2, 10)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatbotMessageResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }]);
    setDraft("");
    setBusy(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const result = await sendChatMessage(message, sessionId);
      setLastResponse(result);
      setLatencyMs(Math.round(performance.now() - startedAt));
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "bot", text: result.reply_text, fallback: result.handoff_required },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được câu hỏi.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      const recorder = recorderRef.current;
      if (!recorder) return;
      setRecording(false);
      setBusy(true);
      try {
        const wav = await recorder.stop();
        recorderRef.current = null;
        const result = await transcribeAudio(wav);
        setDraft(result.text);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Không nhận dạng được giọng nói.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const recorder = await PcmRecorder.create();
      recorderRef.current = recorder;
      recorder.start();
      await recorder.waitUntilReady();
      setRecording(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không mở được microphone.");
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>SmartBot · Chatbot điều hướng</h2>
          <div className="sub">assistant-stream.vnpt.vn/v1/conversation</div>
        </div>
        <div className="topbar-right">
          {health ? <ServiceChip real={health.services.smartbot.real} /> : <Chip variant="neutral">Đang kiểm tra…</Chip>}
        </div>
      </div>

      <div className="content">
        <div className="grid-2">
          <Panel eyebrow="Hội thoại thử nghiệm" title="/api/chatbot/message">
            <div className="chat-scroll" ref={scrollRef}>
              {messages.length === 0 ? (
                <EmptyState text="Gửi một câu hỏi thử nghiệm, hoặc chọn câu mẫu bên dưới." />
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`msg ${message.role}${message.fallback ? " fallback" : ""}`}
                  >
                    {message.text}
                  </div>
                ))
              )}
            </div>
            <div className="btn-row" style={{ margin: "10px 0" }}>
              {SAMPLE_QUESTIONS.map((question) => (
                <button key={question} className="voice-chip" onClick={() => send(question)} disabled={busy}>
                  {question}
                </button>
              ))}
            </div>
            <div className="chat-input-row">
              <button
                className="btn btn-secondary"
                style={recording ? { background: "var(--red)", color: "#fff", borderColor: "var(--red)" } : undefined}
                onClick={toggleRecording}
                disabled={busy && !recording}
                aria-label={recording ? "Dừng ghi âm" : "Ghi âm"}
              >
                {recording ? "■" : "●"}
              </button>
              <input
                type="text"
                placeholder="Nhập câu hỏi thử nghiệm…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void send(draft);
                }}
                disabled={recording}
              />
              <button className="btn btn-primary" onClick={() => send(draft)} disabled={busy || recording || !draft.trim()}>
                Gửi
              </button>
            </div>
            {error ? <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8 }}>{error}</p> : null}
          </Panel>

          <Panel eyebrow="Gỡ lỗi" title="Chi tiết phản hồi gần nhất">
            {lastResponse ? (
              <div>
                <Kv label="intent_name" value={lastResponse.intent_name ?? "-"} mono />
                <Kv label="handoff_required" value={lastResponse.handoff_required ? "có" : "không"} mono />
                <Kv label="cards.length" value={String(lastResponse.cards.length)} mono />
                <Kv label="latency" value={latencyMs !== null ? `${latencyMs} ms` : "-"} mono />
                <Kv label="session_id" value={sessionId} mono />
              </div>
            ) : (
              <EmptyState text="Gửi một câu hỏi để xem intent, handoff và độ trễ thực tế." />
            )}
            {lastResponse && lastResponse.cards.length > 0 ? (
              <div className="scroll-x" style={{ marginTop: 14 }}>
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(lastResponse.cards, null, 2)}
                </pre>
              </div>
            ) : null}
            <div className="foot-note" style={{ marginTop: 16 }}>
              SmartBot chỉ nhận diện ý định; câu trả lời điều hướng luôn được chốt lại bằng dữ liệu{" "}
              <code>session</code> + <code>locations.json</code> thật ở backend.
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
