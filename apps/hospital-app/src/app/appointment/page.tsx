"use client";

/*
  Appointment detail screen — "Chi tiết lịch khám"

  This page is a CLIENT COMPONENT (note "use client" above) because it reads
  from DemoContext to decide which CTA to show at the bottom:
    - sdkEnabled = false → "please ask staff" notice (before SDK)
    - sdkEnabled = true  → green "Tìm đường" button (after SDK)

  Everything else on the page is identical between the two states.
*/

import { useEffect } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ReadAloudButton from "@/components/ReadAloudButton";
import { useDemo } from "@/context/demo";
import SmartUXEvents from "@/integrations/smartux/smartuxEvents";

export default function AppointmentPage() {
  const { sdkEnabled } = useDemo();

  useEffect(() => {
    SmartUXEvents.screenView("Appointment");
  }, []);

  return (
    <div className="flex flex-col flex-1">
      <AppHeader title="Chi tiết lịch khám" backHref="/" />

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Booking stepper ── */}
        <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step.done || i === 3
                  ? "bg-hospital-green text-white"
                  : "bg-gray-200 text-gray-500"}`}>
                {step.done ? "✓" : i + 1}
              </div>
              <span className={`text-[9px] text-center leading-tight
                ${(step.done || i === 3) ? "text-hospital-green font-semibold" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Appointment info card ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-hospital-green-light px-4 py-3 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-hospital-green" fill="none" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-hospital-green font-semibold text-sm">Đã xác nhận đặt lịch</span>
          </div>
          <div className="divide-y divide-gray-100">
            <InfoRow label="Chuyên khoa" value="Tim mạch" speakText="Chuyên khoa Tim mạch" />
            <InfoRow label="Bác sĩ" value="BS. Nguyễn Minh An" speakText="Bác sĩ Nguyễn Minh An" />
            <InfoRow label="Ngày khám" value="01/07/2026" speakText="Ngày khám 01 tháng 07 năm 2026" />
            <InfoRow label="Giờ khám" value="14:00" speakText="Giờ khám 14 giờ" />
            <InfoRow
              label="Phòng khám"
              value="A203 — PK Tim mạch 1, Tầng 2"
              highlight
              speakText="Phòng khám A203, phòng tim mạch 1, tầng 2"
            />
            <InfoRow label="Phí dự kiến" value="300.000 VNĐ" speakText="Phí dự kiến ba trăm nghìn đồng" />
          </div>
        </div>

        {/* ── Important notices ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-500">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span className="text-amber-700 font-semibold text-xs">LƯU Ý QUAN TRỌNG</span>
          </div>
          <ul className="text-amber-700 text-xs space-y-1 leading-relaxed list-disc list-inside">
            <li>Vui lòng có mặt trước 15 phút so với giờ hẹn</li>
            <li>Mang theo CCCD và thẻ BHYT (nếu có)</li>
            <li>Có thể hủy lịch trước 2 tiếng</li>
            <li>Liên hệ hotline nếu cần thay đổi: 1900 888 866</li>
          </ul>
        </div>

        {/* ── CTA — changes based on demo state ── */}
        {sdkEnabled ? (
          /*
            AFTER SDK: green navigation button appears.
            This is the feature the SDK adds — the patient can now get
            real-time voice-guided navigation to their room.
          */
          <div className="space-y-3">
            <Link
              href="/assistant"
              className="flex items-center justify-center gap-2 w-full bg-zinc-900
                         text-white font-bold py-4 rounded-xl text-sm shadow-md active:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth={2} stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-12 0v1.5a6 6 0 006 6zm0 0v3m-3 0h6M12 15a3 3 0 003-3V5.25a3 3 0 10-6 0V12a3 3 0 003 3z" />
              </svg>
              Hỏi trợ lý bằng giọng nói
            </Link>
            <Link
              href="/navigate"
              className="flex items-center justify-center gap-2 w-full bg-hospital-green
                         text-white font-bold py-4 rounded-xl text-sm shadow-md active:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth={2} stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              Tìm đường đến phòng khám
            </Link>
          </div>
        ) : (
          /*
            BEFORE SDK: no navigation feature. The patient only has the room
            number and must ask hospital staff. This is the pain point.
          */
          <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-4 flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-gray-400 flex-shrink-0 mt-0.5"
                 fill="none" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-gray-500 text-sm leading-relaxed">
              Vui lòng hỏi nhân viên y tế tại quầy tiếp đón (Tầng 1) để được hướng dẫn đến phòng khám.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}

const STEPS = [
  { label: "Chọn thành viên", done: true },
  { label: "Chọn phương thức", done: true },
  { label: "Chọn lịch khám", done: true },
  { label: "Xác nhận", done: false },
];

function InfoRow({
  label,
  value,
  highlight = false,
  speakText,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  speakText?: string;
}) {
  const { sdkEnabled } = useDemo();
  return (
    <div className="flex items-start justify-between px-4 py-3 gap-4">
      <span className="text-gray-500 text-sm flex-shrink-0 w-28">{label}</span>
      <div className="flex items-start gap-2 min-w-0">
        <span className={`text-sm font-medium text-right break-words
          ${highlight ? "text-hospital-green" : "text-gray-800"}`}>
          {value}
        </span>
        {sdkEnabled && speakText ? <ReadAloudButton text={speakText} label={label} /> : null}
      </div>
    </div>
  );
}
