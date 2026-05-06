/**
 * /onboarding — 店舗作成ページ
 *
 * 新規ユーザーが初めて「自分の店舗」を登録する画面。
 * (onboarding) ルートグループ内に配置し、ヘッダーナビを表示しない。
 *
 * - サーバーコンポーネント（metadata export のため）
 * - フォーム処理は CreateOrgPageClient → CreateOrgForm クライアントコンポーネントに委譲
 * - 成功または 409「既所有」時は /onboarding/getting-started へ遷移する
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.1
 */
import type { Metadata } from "next";
import { CreateOrgPageClient } from "@/components/onboarding/create-org-page-client";

export const metadata: Metadata = {
  title: "店舗登録 | シフトすけっと",
};

export default function OnboardingPage() {
  return <CreateOrgPageClient />;
}
