/**
 * /onboarding/getting-started — 初期データガイド画面
 *
 * 店舗作成完了直後に表示する「次にやること」のチェックリスト。
 * fetchMeServer() で onboarding の状態を取得し、GettingStartedChecklist に渡す。
 *
 * - サーバーコンポーネント（fetchMeServer() を呼ぶため）
 * - fetchMeServer() が null（401）の場合は /signin にリダイレクト
 * - fetchMeServer() が throw（5xx）の場合は (onboarding)/error.tsx に委ねる
 * - onboarding が null（組織未所属）の場合は /onboarding にリダイレクト
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.2
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchMeServer } from "@/lib/api-server";
import { GettingStartedChecklist } from "@/components/onboarding/getting-started-checklist";

export const metadata: Metadata = {
  title: "はじめましょう | シフトすけっと",
};

export default async function GettingStartedPage() {
  const me = await fetchMeServer();

  // 未認証 or 401 → サインインへ
  if (!me) {
    redirect("/signin");
  }

  // 組織未所属（onboarding が null）→ 店舗作成フォームへ戻す
  if (!me.onboarding) {
    redirect("/onboarding");
  }

  const { staff_count, shift_slot_count, is_complete } = me.onboarding;

  return (
    <GettingStartedChecklist
      staffCount={staff_count}
      shiftSlotCount={shift_slot_count}
      isComplete={is_complete}
    />
  );
}
