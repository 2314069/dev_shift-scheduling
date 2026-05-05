/**
 * ルートランディングページ（状態分岐ハブ）
 *
 * サーバーコンポーネントとして動作し、/api/me の結果に基づいて 3 状態を分岐する。
 * UI を描画せず、サーバーサイドリダイレクトのみを行う。
 *
 * - 未認証              → /signin
 * - 認証済み・店舗未所属 → /onboarding
 * - 認証済み・店舗所属あり → /schedule
 *
 * redirect() は Next.js 本番環境では NEXT_REDIRECT エラーを throw するが、
 * テスト環境ではモックされるため return で明示的に後続処理を止める。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §5.3
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchMeServer } from "@/lib/api-server";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/signin");
    return;
  }

  // fetchMeServer が null を返す（401）場合も未認証扱いで /signin へ
  // 5xx などの場合は Error を throw してルートの error.tsx に委ねる
  const me = await fetchMeServer();
  if (!me) {
    redirect("/signin");
    return;
  }

  if (me.organizations.length === 0) {
    redirect("/onboarding");
    return;
  }

  redirect("/schedule");
}
