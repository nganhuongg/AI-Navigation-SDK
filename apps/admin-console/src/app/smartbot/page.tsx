"use client";

import { useEffect, useRef, useState } from "react";
import { getHealth, sendChatMessage, transcribeAudio } from "@/lib/api";
import { PcmRecorder } from "@/lib/recorder";
import { SMARTBOT_BENCHMARK_CASES, type SmartBotBenchmarkCase } from "@/lib/smartbotBenchmark";
import type { ChatbotMessageResponse, HealthStatus } from "@/lib/types";
import { Chip, EmptyState, Kv, Panel, ServiceChip } from "@/components/ui";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  fallback?: boolean;
};

type BenchmarkResult = SmartBotBenchmarkCase & {
  actualIntent: string | null;
  actualAnswer: string;
  handoffRequired: boolean;
  latencyMs: number | null;
  pass: boolean;
  error: string | null;
};

const SAMPLE_QUESTIONS = [
  "Tôi đi thử máu ở đâu?",
  "Tôi đau ngực uống thuốc gì?",
  "Quầy đăng ký khám ở đâu?",
];

function evaluateBenchmark(test: SmartBotBenchmarkCase, result: ChatbotMessageResponse): boolean {
  const intentPass = (result.intent_name ?? "") === test.expectedIntent;
  const roomPass = test.expectedTargetRoom
    ? result.reply_text.toUpperCase().includes(test.expectedTargetRoom.toUpperCase())
    : true;
  return intentPass && roomPass;
}

function escapeCsv(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

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
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
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

  const benchmarkPassed = benchmarkResults.filter((item) => item.pass).length;
  const benchmarkCompleted = benchmarkResults.length;
  const benchmarkAccuracy =
    benchmarkCompleted > 0 ? Math.round((benchmarkPassed / benchmarkCompleted) * 100) : null;
  const benchmarkAverageLatency =
    benchmarkCompleted > 0
      ? Math.round(
          benchmarkResults.reduce((sum, item) => sum + (item.latencyMs ?? 0), 0) / benchmarkCompleted,
        )
      : null;

  async function runBenchmark() {
    if (benchmarkRunning) return;
    setBenchmarkRunning(true);
    setBenchmarkError(null);
    setBenchmarkResults([]);
    setBenchmarkProgress(0);
    const nextResults: BenchmarkResult[] = [];
    for (const test of SMARTBOT_BENCHMARK_CASES) {
      const startedAt = performance.now();
      try {
        const result = await sendChatMessage(test.question, `${sessionId}_${test.id}`);
        const measuredLatency = Math.round(performance.now() - startedAt);
        const row: BenchmarkResult = {
          ...test,
          actualIntent: result.intent_name,
          actualAnswer: result.reply_text,
          handoffRequired: result.handoff_required,
          latencyMs: measuredLatency,
          pass: evaluateBenchmark(test, result),
          error: null,
        };
        nextResults.push(row);
      } catch (caught) {
        nextResults.push({
          ...test,
          actualIntent: null,
          actualAnswer: "",
          handoffRequired: true,
          latencyMs: null,
          pass: false,
          error: caught instanceof Error ? caught.message : "Benchmark request failed.",
        });
      }
      setBenchmarkResults([...nextResults]);
      setBenchmarkProgress(nextResults.length);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    setBenchmarkRunning(false);
  }

  function exportBenchmarkCsv() {
    if (benchmarkResults.length === 0) return;
    const headers = [
      "id",
      "group",
      "question",
      "expected_intent",
      "actual_intent",
      "expected_target_room",
      "actual_answer",
      "handoff_required",
      "latency_ms",
      "pass",
      "error",
      "notes",
    ];
    const rows = benchmarkResults.map((item) =>
      [
        item.id,
        item.group,
        item.question,
        item.expectedIntent,
        item.actualIntent,
        item.expectedTargetRoom,
        item.actualAnswer,
        item.handoffRequired,
        item.latencyMs,
        item.pass,
        item.error,
        item.notes,
      ]
        .map(escapeCsv)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smartbot-benchmark-results.csv";
    link.click();
    URL.revokeObjectURL(url);
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
        <Panel eyebrow="Benchmark" title="SmartBot batch test">
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={runBenchmark} disabled={benchmarkRunning}>
              {benchmarkRunning
                ? `Đang chạy ${benchmarkProgress}/${SMARTBOT_BENCHMARK_CASES.length}`
                : `Chạy ${SMARTBOT_BENCHMARK_CASES.length} câu benchmark`}
            </button>
            <button
              className="btn btn-secondary"
              onClick={exportBenchmarkCsv}
              disabled={benchmarkRunning || benchmarkResults.length === 0}
            >
              Export CSV
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setBenchmarkResults([]);
                setBenchmarkProgress(0);
                setBenchmarkError(null);
              }}
              disabled={benchmarkRunning || benchmarkResults.length === 0}
            >
              Xóa kết quả
            </button>
          </div>

          <div className="grid-3" style={{ marginBottom: 14 }}>
            <Kv label="cases" value={`${benchmarkCompleted}/${SMARTBOT_BENCHMARK_CASES.length}`} mono />
            <Kv
              label="auto_pass_rate"
              value={benchmarkAccuracy === null ? "-" : `${benchmarkPassed}/${benchmarkCompleted} (${benchmarkAccuracy}%)`}
              mono
            />
            <Kv label="avg_latency" value={benchmarkAverageLatency === null ? "-" : `${benchmarkAverageLatency} ms`} mono />
          </div>

          {benchmarkError ? <p style={{ color: "var(--red)", fontSize: 12.5 }}>{benchmarkError}</p> : null}

          {benchmarkResults.length === 0 ? (
            <EmptyState text="Chạy benchmark để ghi lại câu trả lời, intent, độ trễ và pass/fail sơ bộ." />
          ) : (
            <div className="scroll-x">
              <table style={{ borderCollapse: "collapse", minWidth: 1180, width: "100%", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: 8 }}>ID</th>
                    <th style={{ padding: 8 }}>Group</th>
                    <th style={{ padding: 8 }}>Question</th>
                    <th style={{ padding: 8 }}>Expected</th>
                    <th style={{ padding: 8 }}>Actual</th>
                    <th style={{ padding: 8 }}>Latency</th>
                    <th style={{ padding: 8 }}>Result</th>
                    <th style={{ padding: 8 }}>Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkResults.map((item) => (
                    <tr key={item.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: 8, fontFamily: "var(--font-mono)" }}>{item.id}</td>
                      <td style={{ padding: 8 }}>{item.group}</td>
                      <td style={{ padding: 8, maxWidth: 240 }}>{item.question}</td>
                      <td style={{ padding: 8, fontFamily: "var(--font-mono)" }}>
                        {item.expectedIntent}
                        {item.expectedTargetRoom ? ` / ${item.expectedTargetRoom}` : ""}
                      </td>
                      <td style={{ padding: 8, fontFamily: "var(--font-mono)" }}>{item.actualIntent ?? "-"}</td>
                      <td style={{ padding: 8 }}>{item.latencyMs === null ? "-" : `${item.latencyMs} ms`}</td>
                      <td style={{ padding: 8, color: item.pass ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                        {item.pass ? "PASS" : "FAIL"}
                      </td>
                      <td style={{ padding: 8, minWidth: 360, whiteSpace: "pre-wrap" }}>
                        {item.error ?? item.actualAnswer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="foot-note" style={{ marginTop: 12 }}>
            Auto pass chỉ kiểm tra intent và mã phòng trong câu trả lời. Những case paraphrase/ambiguous vẫn nên được
            đánh giá thủ công trước khi đưa vào slide.
          </div>
        </Panel>
      </div>
    </>
  );
}
