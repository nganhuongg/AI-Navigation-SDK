import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import PhoneShell from "@/components/PhoneShell";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Bệnh viện Demo",
  description: "Ứng dụng bệnh nhân — AI Navigation SDK demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      {/*
        The dark zinc background is the "desk" the phone sits on.
        PhoneShell renders the phone frame + demo toggle + provides DemoContext
        to every page inside.
      */}
      <body className="min-h-screen bg-zinc-700 flex items-start justify-center py-10">
        <PhoneShell>{children}</PhoneShell>
      </body>
    </html>
  );
}
