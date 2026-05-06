"use client";

/**
 * オンボーディングヒントカード（/schedule 上の埋め込みカード）
 *
 * onboarding.is_complete === false のときに /schedule ページ最上部に表示する。
 * dismiss ボタンで「今のセッションのみ非表示」にできる（ページリロードで再表示）。
 * is_complete === true になると親コンポーネントがこのコンポーネントをレンダリングしないため、
 * 自動的に非表示になる。
 */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface OnboardingHintCardProps {
  staffCount: number;
  shiftSlotCount: number;
}

export function OnboardingHintCard({
  staffCount,
  shiftSlotCount,
}: OnboardingHintCardProps) {
  const [dismissed, setDismissed] = useState(false);

  // 全ステップ完了時は表示しない（親での判定が基本だが、props 変更時のフォールバックとして）
  const isComplete = staffCount > 0 && shiftSlotCount > 0;

  if (dismissed || isComplete) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-amber-800 mb-1 text-sm">
            はじめに設定が必要です
          </p>
          <p className="text-sm text-amber-700 mb-3">
            シフト表を作成するには、スタッフとシフト枠の登録が必要です。
          </p>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge
              variant="secondary"
              className={
                staffCount > 0
                  ? "bg-green-100 text-green-800 border-green-200"
                  : ""
              }
            >
              {staffCount > 0 ? "✓ " : ""}スタッフを登録する
            </Badge>
            <Badge
              variant="secondary"
              className={
                shiftSlotCount > 0
                  ? "bg-green-100 text-green-800 border-green-200"
                  : ""
              }
            >
              {shiftSlotCount > 0 ? "✓ " : ""}シフト枠を登録する
            </Badge>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/onboarding/getting-started">
              初期設定ガイドを見る →
            </Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          aria-label="このお知らせを閉じる"
          className="shrink-0 text-amber-700 hover:text-amber-900 hover:bg-amber-100 -mt-1 -mr-1"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
