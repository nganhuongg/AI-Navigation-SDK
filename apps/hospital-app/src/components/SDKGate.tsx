"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { useDemo } from "@/context/demo";

export default function SDKGate({
  children,
  title,
  backHref = "/appointment",
}: {
  children: React.ReactNode;
  title: string;
  backHref?: string;
}) {
  const { sdkEnabled } = useDemo();

  if (sdkEnabled) return <>{children}</>;

  return (
    <div className="flex flex-col flex-1">
      <AppHeader title={title} backHref={backHref} />
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-gray-900 font-semibold text-sm">Tính năng này thuộc lớp SDK</p>
          <p className="text-gray-500 text-sm leading-relaxed mt-2">
            Ở trạng thái trước SDK, ứng dụng bệnh viện chỉ hiển thị lịch khám và số phòng. Hãy bật
            chế độ Sau SDK ở thanh điều khiển demo để xem trợ lý AI, OCR, checklist và bản đồ.
          </p>
          <Link
            href="/appointment"
            className="mt-4 flex h-12 items-center justify-center rounded-lg bg-hospital-green text-white text-sm font-bold"
          >
            Quay lại lịch khám
          </Link>
        </div>
      </main>
    </div>
  );
}
