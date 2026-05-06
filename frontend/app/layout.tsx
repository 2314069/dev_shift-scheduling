/**
 * ルートレイアウト
 *
 * サーバーコンポーネントとして動作し、/api/me の結果に基づいてナビゲーションを制御する。
 *
 * 3 状態の対応:
 *   A. 未ログイン       → ヘッダー非表示（session === null）
 *   B. ログイン済み・店舗未所属 → ヘッダー表示（ロゴ + UserNav のみ）。ナビリンク非表示
 *   C. ログイン済み・店舗所属あり → ヘッダー表示（ロゴ + MainNav + UserNav）
 *
 * SessionProvider は Client Component のため、children として配置する。
 * fetchMeServer のエラー（バックエンドダウン等）は catch(() => null) で吸収し
 * レイアウトがクラッシュしないようにする。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §5.5
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.4, §6.2
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth } from "@/auth";
import { fetchMeServer } from "@/lib/api-server";
import { SessionProvider } from "@/components/auth/session-provider";
import { UserNav } from "@/components/auth/user-nav";
import { MainNav } from "@/components/main-nav";
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
  title: "シフトすけっと",
  description: "シフトすけっと | 小規模店舗のシフト管理",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // fetchMeServer のエラー（バックエンドダウン等）はキャッチして null 扱いにする。
  // レイアウト自体はクラッシュさせず、各ページの error.tsx に委ねる。
  const me = session ? await fetchMeServer().catch(() => null) : null;
  const hasOrg = (me?.organizations.length ?? 0) > 0;

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          {session && (
            <header className="border-b bg-white">
              <div className="container mx-auto flex h-14 items-center justify-between px-4">
                <Link href="/" className="text-lg font-bold">
                  シフトすけっと
                </Link>
                <div className="flex items-center gap-6">
                  {hasOrg && <MainNav />}
                  <UserNav orgName={me?.current_organization?.name} />
                </div>
              </div>
            </header>
          )}
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
