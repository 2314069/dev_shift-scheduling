/**
 * ルート（/）の状態分岐ハブ
 *
 * サーバーコンポーネントとして動作し、/api/me の結果に基づいて分岐する。
 *
 * - 未認証 / セッション無効  → ランディングページを描画（/signin へ自動遷移はしない）
 * - 認証済み・店舗未所属      → /onboarding にリダイレクト
 * - 認証済み・店舗所属あり    → /schedule にリダイレクト
 *
 * redirect() は Next.js 本番環境では NEXT_REDIRECT エラーを throw する。
 * テスト環境ではモックが undefined を返すため、return redirect(...) パターンで
 * 後続処理を止める（テストモックとも整合する）。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §5.3
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchMeServer } from "@/lib/api-server";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return <LandingPage />;
  }

  // fetchMeServer が null を返す（401）場合もランディングを表示する
  // 5xx などの場合は Error を throw してルートの error.tsx に委ねる
  const me = await fetchMeServer();
  if (!me) {
    return <LandingPage />;
  }

  if (me.organizations.length === 0) {
    return redirect("/onboarding");
  }

  return redirect("/schedule");
}
