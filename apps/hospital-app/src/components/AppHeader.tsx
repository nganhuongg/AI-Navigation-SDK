import Link from "next/link";

type Props = {
  title: string;
  backHref?: string;   // when provided, a ← arrow appears that links here
};

/*
  Green header bar used on all sub-screens (Appointment, Navigate, etc.).
  The home screen has its own custom header because it shows the logo.
*/
export default function AppHeader({ title, backHref }: Props) {
  return (
    <header className="bg-hospital-green px-4 h-[56px] flex items-center gap-3 flex-shrink-0">
      {backHref && (
        <Link
          href={backHref}
          className="text-white p-1 -ml-1 rounded-full"
          aria-label="Quay lại"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-white strokeWidth-2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
      )}
      <span className="text-white font-semibold text-base">{title}</span>
    </header>
  );
}
