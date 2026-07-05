import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Rail from "@/components/Rail";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AI Navigation SDK — Admin Console",
  description: "Bảng điều khiển kỹ thuật viên bệnh viện",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--bg)]">
        <div className="shell">
          <Rail />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
