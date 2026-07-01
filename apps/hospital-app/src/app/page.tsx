import Link from "next/link";
import BottomNav from "@/components/BottomNav";

/*
  Home screen — "Trang chủ"
  Inspired by the Bach Mai Hospital app: green header, 3×2 feature grid,
  promo banner, and a today's appointment card that starts the demo flow.

  This is the BEFORE SDK state — the app is functional but has no navigation help.
*/
export default function HomePage() {
  return (
    <div className="flex flex-col flex-1">
      {/* ── Hospital header ── */}
      <header className="bg-hospital-green px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Hospital logo mark — simple cross in a circle */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-hospital-green">
              <path d="M11 3h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">BỆNH VIỆN ĐA KHOA</p>
            <p className="text-white font-bold text-sm leading-tight">HÀ NỘI</p>
          </div>
        </div>
        {/* Notification bell */}
        <button className="text-white p-1" aria-label="Thông báo">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" strokeWidth={2} stroke="white">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>
      </header>

      {/* ── Scrollable page body ── */}
      <main className="flex-1 overflow-y-auto pb-2">

        {/* ── 3×2 Feature grid ── */}
        <div className="grid grid-cols-3 gap-[1px] bg-gray-200 border-b border-gray-200 mx-0">
          <FeatureTile label="Quy trình khám bệnh" icon={<ProcessIcon />} />
          <FeatureTile label="Kết quả khám bệnh"   icon={<ResultsIcon />} highlighted />
          <FeatureTile label="Sức khoẻ cá nhân"    icon={<HealthIcon />} />
          <FeatureTile label="Đặt lịch khám bệnh"  icon={<ScheduleIcon />} />
          <FeatureTile label="Đánh giá hài lòng"   icon={<StarIcon />} />
          <FeatureTile label="Thông báo & nhắc nhở" icon={<BellIcon />} />
        </div>

        {/* ── Promo banner ── */}
        <div className="bg-hospital-green mx-4 mt-4 rounded-2xl p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-white font-bold text-sm leading-snug">
              Tư vấn y tế trực tuyến
            </p>
            <p className="text-white/80 text-xs mt-1 leading-snug">
              Đặt lịch với bác sĩ chuyên khoa, hỗ trợ tận tâm, bảo mật thông tin.
            </p>
            <button className="mt-3 bg-white text-hospital-green text-xs font-bold px-4 py-2 rounded-full">
              ĐẶT LỊCH TƯ VẤN
            </button>
          </div>
          {/* Medical bag icon */}
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
              <path d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zm-8 9H9v-2h3v-3h2v3h3v2h-3v3h-2v-3zm2-9h-4V5h4v2z" />
            </svg>
          </div>
        </div>

        {/* ── Today's appointment card ── */}
        <div className="px-4 mt-4">
          <p className="text-gray-800 font-bold text-base mb-2">Lịch khám hôm nay</p>
          <Link href="/appointment">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {/* Green confirmed badge */}
                    <span className="bg-hospital-green-light text-hospital-green text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Đã xác nhận
                    </span>
                  </div>
                  <p className="text-gray-900 font-semibold text-sm mt-1">Khám Tim mạch</p>
                  <p className="text-gray-500 text-xs mt-0.5">BS. Nguyễn Minh An</p>
                </div>
                {/* Arrow */}
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" fill="none" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  14:00 — 01/07/2026
                </span>
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  A203 — Tầng 2
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* ── Featured articles header ── */}
        <div className="px-4 mt-4 mb-2">
          <p className="text-gray-800 font-bold text-base">Bài viết nổi bật</p>
        </div>

        {/* Placeholder article card */}
        <div className="mx-4 bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex gap-3">
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-hospital-green opacity-50">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 text-sm font-semibold leading-snug line-clamp-2">
              Phòng ngừa bệnh tim mạch: những điều cần biết
            </p>
            <p className="text-gray-400 text-[11px] mt-1">📅 28/06/2026</p>
          </div>
        </div>

      </main>

      {/* ── Bottom navigation ── */}
      <BottomNav />
    </div>
  );
}

/* ─────── Feature tile ─────── */
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
      className={`flex flex-col items-center justify-center gap-2 py-4 bg-white cursor-pointer active:bg-gray-50
        ${highlighted ? "border-2 border-hospital-green" : "border-2 border-transparent"}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center
        ${highlighted ? "bg-hospital-green-light" : "bg-hospital-green-light"}`}>
        {icon}
      </div>
      <span className="text-gray-700 text-[11px] font-medium text-center leading-tight px-1">
        {label}
      </span>
    </div>
  );
}

/* ─────── Icons used in the feature grid ─────── */
function ProcessIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-hospital-green" fill="none" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}
