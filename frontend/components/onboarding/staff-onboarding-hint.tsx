"use client";

/**
 * スタッフ向けオンボーディングカード（/staff?id=X 着地時）
 *
 * 管理者から URL を共有されてアクセスしたスタッフに、最初に何をすべきかを案内する。
 * dismiss 状態は localStorage の `storageKey` で永続化（スタッフ別キー想定）。
 * SSR/CSR でのちらつき回避のため mounted 前は何も描画しない。
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface StaffOnboardingHintProps {
  staffName: string;
  storageKey: string;
}

export function StaffOnboardingHint({
  staffName,
  storageKey,
}: StaffOnboardingHintProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // localStorage はクライアントマウント後にのみアクセス可。
    // SSR/CSR の差分を回避するため mounted フラグで遅延描画する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  if (!mounted || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-blue-900 mb-2 text-sm">
            ようこそ、{staffName} さん
          </p>
          <p className="text-sm text-blue-900 mb-2">
            ここはあなたのシフト希望を提出するページです。
          </p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>
              カレンダーの日付をタップして「希望シフト」「出勤不可」を選びます
            </li>
            <li>変更は最後に「希望を提出」を押すまで保存されません</li>
            <li>提出後も、期間が下書きの間は何度でも上書きできます</li>
          </ul>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          aria-label="このお知らせを閉じる"
          className="shrink-0 text-blue-700 hover:text-blue-900 hover:bg-blue-100 -mt-1 -mr-1"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
