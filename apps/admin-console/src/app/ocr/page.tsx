"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { confirmOcr, extractOcr, getHealth, startSession } from "@/lib/api";
import type { HealthStatus, OCRResult, SessionContext } from "@/lib/types";
import { Chip, EmptyState, Kv, Panel, ServiceChip, StepCard } from "@/components/ui";

const CHECKPOINTS = [
  ["register", "Đăng ký"] as const,
  ["identity", "Xác thực"] as const,
  ["payment", "Thanh toán"] as const,
];

export default function OcrPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [session, setSession] = useState<SessionContext | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markInitialStepsDone, setMarkInitialStepsDone] = useState(true);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setOcrResult(null);
    setError(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(selected ? URL.createObjectURL(selected) : null);
  }

  async function runStartSession() {
    setIsBusy(true);
    setError(null);
    try {
      setSession(await startSession());
      setOcrResult(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được session");
    } finally {
      setIsBusy(false);
    }
  }

  async function runOcr() {
    if (!file) {
      setError("Chọn ảnh phiếu khám trước.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      setOcrResult(await extractOcr(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OCR thất bại");
    } finally {
      setIsBusy(false);
    }
  }

  async function runConfirmOcr() {
    if (!session || !ocrResult) return;
    setIsBusy(true);
    setError(null);
    try {
      setSession(await confirmOcr(session.session_id, ocrResult, markInitialStepsDone));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không áp dụng được trường OCR");
    } finally {
      setIsBusy(false);
    }
  }

  const services = session?.journey.specialized_process?.services ?? [];
  const canConfirm = Boolean(session && ocrResult && !isBusy);
  const roomCodes = Array.from(
    new Set([
      ...(ocrResult ? Object.keys(ocrResult.fields.room_descriptions) : []),
      ...(ocrResult ? Object.keys(ocrResult.fields.room_notes) : []),
      ...(ocrResult ? Object.keys(ocrResult.fields.room_queue_numbers) : []),
    ]),
  );

  return (
    <>
      <div className="topbar">
        <div>
          <h2>OCR · SmartReader</h2>
          <div className="sub">Phiếu khám → trường dữ liệu → hành trình cá nhân hoá</div>
        </div>
        <div className="topbar-right">
          {health ? <ServiceChip real={health.services.ocr.real} /> : <Chip variant="neutral">Đang kiểm tra…</Chip>}
        </div>
      </div>

      <div className="content">
        <div className="grid-2">
          <Panel eyebrow="Bước 1" title="Ảnh phiếu khám">
            <div className="stack">
              <label className="dropzone">
                {file ? (
                  <>
                    <strong>{file.name}</strong> đã chọn
                    <br />
                  </>
                ) : null}
                Kéo thả hoặc bấm để chọn ảnh phiếu khám (JPG, PNG, PDF)
                <input type="file" accept="image/*,.pdf" onChange={onFileChange} className="sr-only" style={{ display: "none" }} />
              </label>
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Ảnh phiếu khám đã chọn"
                  style={{
                    height: 200,
                    width: "100%",
                    objectFit: "contain",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--bg)",
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 200,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    fontSize: 12.5,
                  }}
                >
                  Chưa chọn ảnh
                </div>
              )}
              <div className="btn-row">
                <button className="btn btn-secondary" onClick={runStartSession} disabled={isBusy}>
                  Bắt đầu phiên
                </button>
                <button className="btn btn-primary" onClick={runOcr} disabled={isBusy || !file}>
                  Chạy OCR (SmartReader)
                </button>
              </div>
              <label style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--muted)", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={markInitialStepsDone}
                  onChange={(event) => setMarkInitialStepsDone(event.target.checked)}
                  style={{ marginTop: 2 }}
                />
                Đánh dấu Đăng ký / Xác thực / Thanh toán đã xong trước khi áp dụng OCR
              </label>
            </div>
          </Panel>

          <Panel
            eyebrow="Bước 2"
            title="Trường dữ liệu trích xuất"
            action={ocrResult ? <div className="metric" style={{ textAlign: "right", padding: "8px 14px" }}>
              <div className="m-label">Độ tin cậy</div>
              <div className="m-value">{Math.round(ocrResult.confidence * 100)}%</div>
            </div> : undefined}
          >
            {ocrResult ? (
              <div>
                <Kv label="Nguồn ảnh" value={ocrResult.source_image} />
                <Kv label="Mã phòng ban đầu" value={ocrResult.fields.initial_exam_room ?? "-"} mono />
                <Kv
                  label="Mã phòng phát hiện"
                  value={ocrResult.fields.detected_room_codes.join(", ") || "-"}
                  mono
                />
                <Kv label="Phòng trả kết quả" value={ocrResult.fields.return_room ?? "-"} mono />
                <Kv label="Cần xác nhận" value={ocrResult.requires_user_confirmation ? "Có" : "Không"} />
                <Kv label="Độ tin cậy thấp" value={ocrResult.is_low_confidence ? "Có" : "Không"} />
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-success" onClick={runConfirmOcr} disabled={!canConfirm}>
                    Áp dụng vào hành trình
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState text="Chạy OCR để xem trường dữ liệu trích xuất." />
            )}
          </Panel>
        </div>

        {ocrResult && roomCodes.length > 0 ? (
          <Panel eyebrow="Chi tiết theo phòng" title="Mô tả · Ghi chú · Số thứ tự">
            <div className="scroll-x">
              <div style={{ minWidth: 640 }} className="stack">
                {roomCodes.map((room) => (
                  <div key={room} className="kv" style={{ gridTemplateColumns: "90px 1fr 90px" }}>
                    <span className="v mono">{room}</span>
                    <span className="k">
                      {ocrResult.fields.room_descriptions[room] ?? ocrResult.fields.room_notes[room] ?? "-"}
                    </span>
                    <span className="v mono">
                      {ocrResult.fields.room_queue_numbers[room] ? `STT ${ocrResult.fields.room_queue_numbers[room]}` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        ) : null}

        {error ? <EmptyState text={error} /> : null}

        <Panel eyebrow="Bước 3" title="Hành trình sau xác nhận">
          {session ? (
            <div className="stack">
              <div className="grid-3">
                {CHECKPOINTS.map(([key, label]) => {
                  const checkpoint = session.journey[key];
                  return (
                    <StepCard
                      key={key}
                      label={label}
                      room={checkpoint.location_code}
                      detail={checkpoint.room}
                      status={checkpoint.is_done ? "done" : "pending"}
                    />
                  );
                })}
              </div>
              <div className="grid-3">
                {services.length > 0 ? (
                  services.map((service) => (
                    <StepCard
                      key={service.service_id}
                      label={service.service_name}
                      room={service.room}
                      detail={service.room_name}
                      status={service.status}
                    />
                  ))
                ) : (
                  <EmptyState text="Chưa có hành trình chuyên khoa. Xác nhận OCR để điền phần này." />
                )}
              </div>
              <div className="panel" style={{ borderColor: "var(--blue)", background: "var(--blue-tint)" }}>
                <div className="eyebrow" style={{ color: "var(--blue-ink)" }}>
                  Hành động tiếp theo
                </div>
                <p style={{ marginTop: 4, fontWeight: 700, color: "var(--blue-ink)" }}>{session.next_action.message}</p>
              </div>
            </div>
          ) : (
            <EmptyState text="Bắt đầu phiên để xem hành trình." />
          )}
        </Panel>
      </div>
    </>
  );
}
