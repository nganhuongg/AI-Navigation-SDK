"use client";

import { useEffect } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { useDemo } from "@/context/demo";
import SmartUXEvents from "@/integrations/smartux/smartuxEvents";

export default function HomePage() {
  const { sdkEnabled } = useDemo();

  useEffect(() => {
    SmartUXEvents.screenView("Home");
  }, []);

  return (
    <div className="flex flex-col flex-1">
      <header className="flex flex-shrink-0 items-center justify-between bg-hospital-green px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-hospital-green">
              <path d="M11 3h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">BỆNH VIỆN ĐA KHOA</p>
            <p className="text-sm font-bold leading-tight text-white">HÀ NỘI</p>
          </div>
        </div>
        <button className="p-1 text-white" aria-label="Thông báo">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="white" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-2">
        {sdkEnabled ? (
          <div className="px-4 mt-4">
            <Link
              href="/assistant?screen=voice"
              className="block relative overflow-hidden rounded-[28px] bg-hospital-green p-5 text-white shadow-lg"
            >
              <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-[72%]">
                  <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-50">
                    Mới: Trợ lý AI
                  </span>
                  <h2 className="mt-2 text-2xl font-bold leading-tight">Trợ lý AI điều hướng</h2>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-emerald-50">
                    Chạm vào micro để hỏi ngay trên màn hình: bác đi đâu tiếp theo, phòng nào, tầng nào.
                  </p>
                </div>
                <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/20">
                  <div className="absolute inset-0 animate-ping rounded-full border-2 border-white/40 opacity-60" />
                  <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-white stroke-[2.2]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-[13px] font-semibold leading-snug">
                “Tôi vừa khám xong thì đi đâu?”
              </div>
              <div className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-black text-[#008751]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2.2]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 0 1-14 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
                </svg>
                HỎI TRỢ LÝ AI NGAY
              </div>
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-[1px] bg-gray-200 border-b border-gray-200 mx-0 mt-4">
          <FeatureTile label="Quy trình khám bệnh" icon={<ProcessIcon />} />
          <FeatureTile label="Kết quả khám bệnh" icon={<ResultsIcon />} highlighted />
          <FeatureTile label="Sức khỏe cá nhân" icon={<HealthIcon />} />
          <FeatureTile label="Đặt lịch khám bệnh" icon={<ScheduleIcon />} />
          <FeatureTile label="Đánh giá hài lòng" icon={<StarIcon />} />
          <FeatureTile label="Thông báo & nhắc nhở" icon={<BellIcon />} />
        </div>

        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-hospital-green p-4">
          <div className="flex-1">
            <p className="text-sm font-bold leading-snug text-white">Tư vấn y tế trực tuyến</p>
            <p className="mt-1 text-xs leading-snug text-white/80">
              Đặt lịch với bác sĩ chuyên khoa, hỗ trợ tận tâm, bảo mật thông tin.
            </p>
            <button className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold text-hospital-green">
              ĐẶT LỊCH TƯ VẤN
            </button>
          </div>
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white">
              <path d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zm-8 9H9v-2h3v-3h2v3h3v2h-3v3h-2v-3zm2-9h-4V5h4v2z" />
            </svg>
          </div>
        </div>

        <div className="px-4 mt-4">
          <p className="mb-2 text-base font-bold text-gray-800">Lịch khám hôm nay</p>
          <Link href="/appointment">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-hospital-green-light px-2 py-0.5 text-[10px] font-semibold text-hospital-green">
                      Đã xác nhận
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900">Khám Tim mạch</p>
                  <p className="mt-0.5 text-xs text-gray-500">BS. Nguyễn Minh An</p>
                </div>
                <svg viewBox="0 0 24 24" className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  14:00 - 01/07/2026
                </span>
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  A203 - Tầng 2
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="px-4 mt-4 mb-2">
          <p className="text-base font-bold text-gray-800">Bài viết nổi bật</p>
        </div>

        <div className="mx-4 flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
              <svg viewBox="0 0 24 24" className="h-8 w-8 fill-hospital-green opacity-50">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-800">
              Phòng ngừa bệnh tim mạch: những điều cần biết
            </p>
            <p className="mt-1 text-[11px] text-gray-400">28/06/2026</p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function FeatureTile({
  label,
  icon,
  highlighted = false,
}: {
  label: string;
  icon: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-white py-4 ${
        highlighted ? "border-2 border-hospital-green" : "border-2 border-transparent"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hospital-green-light">
        {icon}
      </div>
      <span className="px-1 text-center text-[11px] font-medium leading-tight text-gray-700">{label}</span>
    </div>
  );
}

function ProcessIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}
