"use client";

import { useEffect, useRef, useState } from "react";
import { getEngineBaseUrl } from "@/lib/api";
import SmartUXEvents from "@/integrations/smartux/smartuxEvents";

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

type TTSResponse = {
  audio_base64: string;
  media_type: string;
  sample_rate: number;
};

async function synthesize(text: string, voice: string): Promise<TTSResponse> {
  const response = await fetch(`${getEngineBaseUrl()}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  const body = (await response.json()) as ApiResponse<TTSResponse>;
  if (!response.ok || !body.success || body.data === null) {
    throw new Error(body.error || `TTS failed with ${response.status}`);
  }
  return body.data;
}

function buildAudioUrl(result: TTSResponse): string {
  return `data:${result.media_type};base64,${result.audio_base64}`;
}

export default function ReadAloudButton({
  text,
  label,
  voice = "female_north",
  className = "",
  inlineLabel = false,
}: {
  text: string;
  label?: string;
  voice?: string;
  className?: string;
  inlineLabel?: boolean;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  async function handleClick() {
    const content = text.trim();
    if (!content || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      SmartUXEvents.voiceGuidePlayed(label || "ReadAloud", {
        source: "read_aloud_button",
      });
      const result = await synthesize(content, voice);
      const audio = new Audio(buildAudioUrl(result));
      audioRef.current?.pause();
      audioRef.current = audio;
      await audio.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không phát được âm thanh");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy || !text.trim()}
      className={`inline-flex min-h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border border-hospital-green/20 bg-hospital-green-light px-2 text-hospital-green transition active:scale-95 disabled:opacity-40 ${className}`}
      aria-label={label ? `Đọc ${label}` : "Đọc nội dung"}
      title={error || (isBusy ? "Đang đọc" : "Đọc nội dung")}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5.5L7.5 8H5.25A1.25 1.25 0 004 9.25v5.5A1.25 1.25 0 005.25 16H7.5L11 18.5V5.5zm5.5 2a5 5 0 010 9m2.5-11.5a8 8 0 010 14"
        />
      </svg>
      {inlineLabel ? (
        <span className="text-[11px] font-bold">{isBusy ? "Đang đọc" : "Nghe"}</span>
      ) : null}
    </button>
  );
}
