import AppHeader from "@/components/AppHeader";

/*
  Navigation screen — BEFORE SDK version.

  This screen is INTENTIONALLY frustrating to use. It is the "pain point" screen.
  The hospital app has the patient's destination (A203, Floor 2)
  but can only offer:
    1. Static text directions — ambiguous, hard to follow in a busy hospital
    2. A non-interactive floor map — no "you are here", no path, no zoom
    3. A phone number to call for help — the real fallback everyone uses

  Contrast this with the After-SDK screen to show what the SDK solves.
*/
export default function NavigatePage() {
  return (
    <div className="flex flex-col flex-1">
      <AppHeader title="Hướng dẫn đường đi" backHref="/appointment" />

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Destination card ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-hospital-green-light rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-hospital-green" fill="none" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-400">Điểm đến</p>
            <p className="text-gray-900 font-bold text-sm">A203 — PK Tim mạch 1</p>
            <p className="text-gray-500 text-xs">Tầng 2 — Khám lâm sàng</p>
          </div>
        </div>

        {/* ── Static text directions ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-gray-800 font-semibold text-sm mb-3">Chỉ dẫn đường đi</p>
          <ol className="space-y-3">
            {DIRECTIONS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[11px] font-bold
                                 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-gray-600 text-sm leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-gray-400 text-xs mt-4 italic">
            * Thời gian di chuyển ước tính: 8–12 phút
          </p>
        </div>

        {/* ── Static floor map ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-gray-800 font-semibold text-sm">Sơ đồ tầng 2 — Khám lâm sàng</p>
            <span className="text-gray-400 text-[11px]">(Không tương tác)</span>
          </div>
          {/*
            Simple SVG floor plan.
            A203 is highlighted in amber — the patient can see WHERE they need to go
            but has no way to plan a route because there is no "you are here" marker.
            This is the visual representation of the problem.
          */}
          <FloorPlanSVG />
          <p className="text-gray-400 text-[11px] px-4 pb-3 text-center">
            Bản đồ chỉ mang tính tham khảo. Không hiển thị vị trí hiện tại.
          </p>
        </div>

        {/* ── Help section ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-gray-800 font-semibold text-sm mb-1">Cần hỗ trợ?</p>
          <p className="text-gray-500 text-xs mb-3">
            Nhân viên hướng dẫn có mặt tại quầy tiếp đón — Tầng 1, gần cổng chính.
          </p>
          <a
            href="tel:02438693731"
            className="flex items-center justify-center gap-2 w-full border-2 border-hospital-green
                       text-hospital-green font-bold py-3 rounded-xl text-sm active:bg-hospital-green-light"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Gọi bộ phận hướng dẫn: 024 3869 3731
          </a>
        </div>

      </main>
    </div>
  );
}

/* ─────── Static text directions ─────── */
const DIRECTIONS = [
  "Từ cổng chính (số 78 Đường Giải Phóng), đi thẳng vào khuôn viên bệnh viện khoảng 150m.",
  "Đi qua khu nhà hành chính (tòa nhà thấp bên trái), tiếp tục đi thẳng, rẽ trái tại ngã tư trong khuôn viên.",
  "Đi thẳng đến khu thang máy chính, theo biển chỉ dẫn khu khám lâm sàng tầng 2.",
  "Lên tầng 2 bằng thang máy hoặc thang bộ gần sảnh chính.",
  "Ra khỏi thang máy, đi theo biển \"PK Nội tổng quát / Tim mạch\" về phía hành lang chính.",
  "A203 — PK Tim mạch 1 nằm trong dãy phòng A201–A210 trên tầng 2.",
];

/* ─────── SVG floor plan ─────── */
/*
  This is a simplified top-down view of Floor 2 from the raw hospital dataset.
  The plan deliberately has no "you are here" marker, no path line,
  and no interactive elements — the patient can see A203 highlighted
  in yellow but cannot navigate to it from the map.
*/
function FloorPlanSVG() {
  return (
    <svg
      viewBox="0 0 340 200"
      className="w-full"
      style={{ fontFamily: "Be Vietnam Pro, Arial, sans-serif" }}
    >
      {/* ── Background ── */}
      <rect width="340" height="200" fill="#F9FAFB" />

      {/* ── Outer building wall ── */}
      <rect x="4" y="4" width="332" height="192" fill="white"
            stroke="#9CA3AF" strokeWidth="2" rx="4" />

      {/* ── Horizontal corridor ── */}
      <rect x="4" y="85" width="332" height="30" fill="#F3F4F6" stroke="none" />
      <line x1="4" y1="85"  x2="336" y2="85"  stroke="#D1D5DB" strokeWidth="1" />
      <line x1="4" y1="115" x2="336" y2="115" stroke="#D1D5DB" strokeWidth="1" />
      <text x="170" y="105" textAnchor="middle" fontSize="9" fill="#9CA3AF" fontWeight="500">
        ← HÀNH LANG →
      </text>

      {/* ── Top row: floor-2 clinical rooms + stairs ── */}
      <Room x={4}   y={4}  w={84} h={81} number="A201" label="Nội TQ 1" />
      <Room x={90}  y={4}  w={84} h={81} number="A202" label="Nội TQ 2" />
      <Room x={176} y={4}  w={84} h={81} number="A204" label="Tim mạch 2" />
      {/* Staircase top-right */}
      <rect x="262" y="4" width="74" height="81" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
      <text x="299" y="38" textAnchor="middle" fontSize="8" fill="#3B82F6">Thang</text>
      <text x="299" y="50" textAnchor="middle" fontSize="8" fill="#3B82F6">bộ</text>
      <StaircaseIcon cx={299} cy={65} />

      {/* ── Bottom row: floor-2 clinical rooms + target A203 ── */}
      <Room x={4}   y={115} w={84} h={81} number="A205" label="Hô hấp 1" />
      <Room x={90}  y={115} w={84} h={81} number="A206" label="Hô hấp 2" />
      <Room x={176} y={115} w={84} h={81} number="A207" label="Tiêu hóa 1" />

      {/* A203 — the destination, highlighted in amber */}
      <rect x="262" y="115" width="74" height="81"
            fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2"
            strokeDasharray="5,3" rx="2" />
      <text x="299" y="143" textAnchor="middle" fontSize="9" fill="#92400E" fontWeight="700">
        A203
      </text>
      <text x="299" y="155" textAnchor="middle" fontSize="7" fill="#92400E">
        Tim mạch 1
      </text>
      {/* Star marker — destination */}
      <text x="299" y="175" textAnchor="middle" fontSize="14" fill="#F59E0B">★</text>

      {/* ── Elevator ── */}
      <rect x="88" y="85" width="2" height="30" fill="white" />
      <rect x="174" y="85" width="2" height="30" fill="white" />
      <rect x="260" y="85" width="2" height="30" fill="white" />

      {/* Legend */}
      <rect x="8" y="182" width="8" height="8" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3,2" />
      <text x="20" y="190" fontSize="7" fill="#6B7280">Phòng mục tiêu</text>
    </svg>
  );
}

/* A plain room box with number and label */
function Room({
  x, y, w, h,
  number, label,
}: {
  x: number; y: number; w: number; h: number;
  number: string; label: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h}
            fill="white" stroke="#D1D5DB" strokeWidth="1" />
      <text x={x + w / 2} y={y + h / 2 - 6}
            textAnchor="middle" fontSize="10" fill="#374151" fontWeight="700">
        {number}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 9}
            textAnchor="middle" fontSize="7" fill="#9CA3AF">
        {label}
      </text>
    </>
  );
}

/* Simple staircase icon */
function StaircaseIcon({ cx, cy }: { cx: number; cy: number }) {
  const s = 10;
  return (
    <g stroke="#3B82F6" strokeWidth="1.5" fill="none">
      <polyline points={`${cx - s},${cy + s / 2} ${cx - s},${cy - s / 4} ${cx},${cy - s / 4} ${cx},${cy - s} ${cx + s},${cy - s} ${cx + s},${cy + s / 2}`} />
    </g>
  );
}
