"use client";

import Link from "next/link";
import { useDemo } from "@/context/demo";

export default function HomeVoiceAssistantButton() {
  const { sdkEnabled } = useDemo();

  if (!sdkEnabled) {
    return null;
  }

  return (
    <div className="px-4 mt-4">
      <Link
        href="/assistant"
        className="flex min-h-24 items-center gap-4 rounded-2xl bg-zinc-900 px-5 py-4 text-white shadow-lg active:scale-[0.99]"
      >
        <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-hospital-green">
          <MicIcon />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-bold leading-snug">Hỏi trợ lý bằng giọng nói</span>
          <span className="mt-1 block text-sm leading-relaxed text-white/75">
            Bác nói câu hỏi, hệ thống đổi sang chữ rồi trả lời theo quy trình bệnh viện.
          </span>
        </span>
      </Link>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-12 0v1.5a6 6 0 006 6zm0 0v3m-3 0h6M12 15a3 3 0 003-3V5.25a3 3 0 10-6 0V12a3 3 0 003 3z"
      />
    </svg>
  );
}
