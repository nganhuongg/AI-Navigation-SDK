"use client";

/*
  PhoneShell — the outer chrome for the demo.

  Contains three things:
    1. DemoProvider  — makes SDK state available to all child pages
    2. The phone frame — visual device border (color changes when SDK is on)
    3. DemoToggle bar — sits BELOW the phone, outside the app UI

  Why merge these into one component?
  The toggle needs to both READ and WRITE the same state as the pages inside
  the phone. Putting everything under one Provider keeps the state in one place.
*/

import { useEffect } from "react";
import { DemoProvider, useDemo } from "@/context/demo";
import SmartUXEvents from "@/integrations/smartux/smartuxEvents";

export default function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <SmartUXCrashLogger />
      <div className="flex flex-col items-center gap-5">
        <PhoneFrame>{children}</PhoneFrame>
        <DemoToggleBar />
      </div>
    </DemoProvider>
  );
}

function SmartUXCrashLogger() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      SmartUXEvents.exception(event.error || event.message || "Unhandled window error", {
        source: "window.error",
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      SmartUXEvents.exception(event.reason || "Unhandled promise rejection", {
        source: "unhandledrejection",
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

/* ── Phone frame ── */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { sdkEnabled } = useDemo();

  return (
    <div
      className={`w-[390px] h-[844px] flex flex-col overflow-hidden rounded-[44px] border-[12px] shadow-2xl bg-hospital-gray
        transition-colors duration-500
        ${sdkEnabled ? "border-hospital-green" : "border-zinc-900"}`}
    >
      {/* Fake status bar */}
      <div
        className={`h-[42px] flex items-center justify-between px-6 flex-shrink-0
          transition-colors duration-500
          ${sdkEnabled ? "bg-hospital-green" : "bg-zinc-900"}`}
      >
        <span className="text-white text-sm font-semibold tracking-wide">09:22</span>
        <div className="flex items-center gap-2">
          {/* Signal bars */}
          <svg viewBox="0 0 20 14" className="w-5 h-3.5 fill-white">
            <rect x="0"  y="8" width="4" height="6" rx="1" />
            <rect x="5"  y="5" width="4" height="9" rx="1" />
            <rect x="10" y="2" width="4" height="12" rx="1" />
            <rect x="15" y="0" width="4" height="14" rx="1" opacity="0.3" />
          </svg>
          <span className="text-white text-xs font-medium">4G</span>
          {/* Battery */}
          <svg viewBox="0 0 26 14" className="w-6 h-3.5">
            <rect x="0.5" y="1" width="21" height="12" rx="2"
                  stroke="white" strokeWidth="1.5" fill="none" />
            <rect x="22" y="4" width="3" height="6" rx="1" fill="white" />
            <rect x="2"  y="2.5" width="14" height="9" rx="1" fill="white" />
          </svg>
        </div>
      </div>

      {/* Page content. Individual screens own their scroll areas inside the phone. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden font-sans">
        {children}
      </div>
    </div>
  );
}

/* ── Demo toggle bar — sits below the phone frame ── */
function DemoToggleBar() {
  const { sdkEnabled, toggle } = useDemo();

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-zinc-500 text-[10px] font-semibold tracking-widest uppercase">
        Demo Controls
      </span>
      <div className="bg-zinc-900 rounded-2xl p-1.5 flex gap-1">

        {/* Before SDK button */}
        <button
          onClick={() => sdkEnabled && toggle()}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
            ${!sdkEnabled
              ? "bg-white text-zinc-900 shadow"
              : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Trước SDK
        </button>

        {/* After SDK button */}
        <button
          onClick={() => !sdkEnabled && toggle()}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2
            ${sdkEnabled
              ? "bg-hospital-green text-white shadow"
              : "text-zinc-500 hover:text-zinc-300"}`}
        >
          {/* Spark icon — hints at AI magic */}
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
            <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
          </svg>
          Sau SDK
        </button>

      </div>
    </div>
  );
}
