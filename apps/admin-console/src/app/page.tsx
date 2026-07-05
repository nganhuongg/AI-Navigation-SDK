"use client";

import { useEffect, useState } from "react";
import { getEngineBaseUrl, getHealth, listMaps } from "@/lib/api";
import type { HealthStatus, MapListItem } from "@/lib/types";
import { Chip, EmptyState } from "@/components/ui";

export default function OverviewPage() {
  const [engineUrl, setEngineUrl] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapListItem[] | null>(null);

  useEffect(() => {
    setEngineUrl(getEngineBaseUrl());
    getHealth()
      .then(setHealth)
      .catch((caught) => setHealthError(caught instanceof Error ? caught.message : "Không kết nối được engine"));
    listMaps()
      .then(setMaps)
      .catch(() => setMaps([]));
  }, []);

  const verifiedMap = maps?.find((item) => item.status === "verified") ?? maps?.[0] ?? null;

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Tổng quan hệ thống</h2>
          <div className="sub">Trạng thái các dịch vụ VNPT đang chạy trên engine</div>
        </div>
        <div className="topbar-right">
          <span className="engine-badge">{engineUrl ?? "…"}</span>
        </div>
      </div>

      <div className="content">
        {healthError ? (
          <EmptyState text={`Không lấy được trạng thái engine: ${healthError}. Kiểm tra backend đang chạy trên cổng 8001.`} />
        ) : null}

        <div className="grid-2">
          <ServiceCard
            eyebrow="OCR"
            name="SmartReader"
            sub="/rpa-service/aidigdoc/v1/ocr/scan-table"
            description="Ảnh phiếu khám → mã phòng, mô tả, số thứ tự → xác nhận vào hành trình khám."
            real={health?.services.ocr.real ?? null}
            href="/ocr"
            cta="Mở bảng OCR"
          />
          <ServiceCard
            eyebrow="SmartVoice"
            name="STT + TTS"
            sub="/stt-service/v1/grpc/standard · /tts-service/v2/standard"
            description="Giọng nói bệnh nhân → văn bản, và văn bản chỉ đường → giọng đọc."
            real={
              health ? health.services.smartvoice_stt.real && health.services.smartvoice_tts.real : null
            }
            href="/smartvoice"
            cta="Mở bảng SmartVoice"
          />
          <ServiceCard
            eyebrow="SmartBot"
            name="Chatbot điều hướng"
            sub="assistant-stream.vnpt.vn/v1/conversation"
            description="Nhận diện ý định + trả lời điều hướng, luôn chốt lại bằng dữ liệu hành trình thật."
            real={health?.services.smartbot.real ?? null}
            href="/smartbot"
            cta="Mở bảng SmartBot"
          />
          <div className="overview-card">
            <div className="oc-top">
              <div>
                <div className="eyebrow">Dựng bản đồ</div>
                <div className="oc-name">{verifiedMap?.map_id ?? "Chưa có bản đồ"}</div>
              </div>
              {verifiedMap ? (
                <Chip variant={verifiedMap.status === "verified" ? "busy" : "neutral"}>
                  {verifiedMap.status === "verified" ? "Đã xác thực" : "Bản nháp"}
                </Chip>
              ) : (
                <Chip variant="neutral">Chưa có</Chip>
              )}
            </div>
            {verifiedMap ? (
              <div className="oc-sub">
                {verifiedMap.floor_count} tầng · {verifiedMap.node_count} nút · {verifiedMap.edge_count} cạnh ·{" "}
                {verifiedMap.poi_count} POI
              </div>
            ) : (
              <div className="oc-sub">Chưa số hoá bản đồ nào</div>
            )}
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Số hoá bản đồ nhiều tầng, gán POI, tìm đường ngắn nhất trên đồ thị đã xác thực.
            </p>
            <div className="oc-foot">
              <a className="btn btn-primary" href="/map-builder">
                Mở bảng dựng bản đồ
              </a>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="foot-note">
            Trạng thái Thực/Mock đọc trực tiếp từ <code>USE_VNPT_*</code> trong <code>.env</code> qua{" "}
            <code>GET /health</code>. Đặt lại <code>false</code> bất kỳ lúc nào để quay về mock, đảm bảo demo
            không phụ thuộc kết nối ngoài.
          </div>
        </div>
      </div>
    </>
  );
}

function ServiceCard({
  eyebrow,
  name,
  sub,
  description,
  real,
  href,
  cta,
}: {
  eyebrow: string;
  name: string;
  sub: string;
  description: string;
  real: boolean | null;
  href: string;
  cta: string;
}) {
  return (
    <div className="overview-card">
      <div className="oc-top">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="oc-name">{name}</div>
        </div>
        {real === null ? (
          <Chip variant="neutral">Đang kiểm tra…</Chip>
        ) : real ? (
          <Chip variant="real">Thực · đã kết nối</Chip>
        ) : (
          <Chip variant="mock">Mock · offline</Chip>
        )}
      </div>
      <div className="oc-sub">{sub}</div>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>{description}</p>
      <div className="oc-foot">
        <a className="btn btn-primary" href={href}>
          {cta}
        </a>
      </div>
    </div>
  );
}
