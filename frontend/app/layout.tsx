import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "シフトスケジューラー",
  description: "シフト管理アプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b bg-white">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <Link href="/schedule" className="text-lg font-bold">
              シフトスケジューラー
            </Link>
            <nav className="flex gap-6">
              <Link
                href="/settings"
                className="text-sm font-medium hover:text-primary"
              >
                設定
              </Link>
              <Link
                href="/staff"
                className="text-sm font-medium hover:text-primary"
              >
                希望入力
              </Link>
              <Link
                href="/view"
                className="text-sm font-medium hover:text-primary"
              >
                シフト確認
              </Link>
              <Link
                href="/schedule"
                className="text-sm font-medium hover:text-primary"
              >
                シフト表
              </Link>
            </nav>
          </div>
        </header>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
