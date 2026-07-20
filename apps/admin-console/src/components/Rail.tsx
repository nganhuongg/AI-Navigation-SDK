"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getEngineBaseUrl, getHealth } from "@/lib/api";
import type { HealthStatus } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Tổng quan", icon: "▣", statusKey: null },
  { href: "/ocr", label: "OCR · SmartReader", icon: "▤", statusKey: "ocr" as const },
  { href: "/smartvoice", label: "SmartVoice", icon: "◐", statusKey: "smartvoice" as const },
  { href: "/smartbot", label: "SmartBot", icon: "◔", statusKey: "smartbot" as const },
  { href: "/care-journey", label: "Care Journey", icon: "CJ", statusKey: null },
  { href: "/map-builder", label: "Dựng bản đồ", icon: "▨", statusKey: null },
];

export default function Rail() {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  // Computed after mount only — reading window.location during the first
  // client render (before hydration settles) would not match the server-
  // rendered markup and trigger a hydration warning.
  const [engineUrl, setEngineUrl] = useState<string | null>(null);

  useEffect(() => {
    setEngineUrl(getEngineBaseUrl());
    let cancelled = false;
    getHealth()
      .then((result) => {
        if (!cancelled) setHealth(result);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function dotColor(statusKey: "ocr" | "smartvoice" | "smartbot" | null): string | undefined {
    if (!statusKey) return undefined;
    if (!health) return "var(--muted)";
    if (statusKey === "smartvoice") {
      return health.services.smartvoice_stt.real && health.services.smartvoice_tts.real
        ? "var(--green)"
        : "var(--amber)";
    }
    return health.services[statusKey].real ? "var(--green)" : "var(--amber)";
  }

  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="eyebrow">Bảng điều khiển</div>
        <h1>AI Navigation SDK</h1>
      </div>
      <nav className="rail-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          const color = dotColor(item.statusKey);
          return (
            <a key={item.href} className={`rail-item${isActive ? " active" : ""}`} href={item.href}>
              <span className="ico">{item.icon}</span>
              <span className="name">{item.label}</span>
              {color ? <span className="rail-dot" style={{ background: color }} /> : null}
            </a>
          );
        })}
      </nav>
      <div className="rail-foot">
        Địa chỉ engine <code>{engineUrl ?? "…"}</code>
        <br />
        Mock luôn sẵn có làm phương án dự phòng offline.
      </div>
    </aside>
  );
}
