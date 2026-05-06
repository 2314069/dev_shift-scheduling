/**
 * メインナビゲーションリンク群
 *
 * 店舗所属あり（hasOrg === true）のときのみ app/layout.tsx から条件レンダリングされる。
 * Server Component。props は受け取らず、内部で fetchMeServer を呼ばない。
 * hasOrg の判定は親 layout で完結する。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §8.3
 */
import Link from "next/link";

export function MainNav() {
  return (
    <nav className="flex gap-6">
      <Link href="/settings" className="text-sm font-medium hover:text-primary">
        設定
      </Link>
      <Link href="/staff" className="text-sm font-medium hover:text-primary">
        希望入力
      </Link>
      <Link href="/view" className="text-sm font-medium hover:text-primary">
        シフト確認
      </Link>
      <Link href="/schedule" className="text-sm font-medium hover:text-primary">
        シフト表
      </Link>
    </nav>
  );
}
