"use client";

/**
 * 各メイン画面の冒頭に「この画面でできること + 操作の流れ」を示す
 * 閉じれる情報カード。
 *
 * dismiss 状態は localStorage の `storageKey` で永続化する。
 * SSR/CSR でのちらつきを避けるため、mounted 前は何も描画しない。
 *
 * 既存 `OnboardingHintCard` は amber 警告色＋データ未登録ロジック特化のため、
 * 情報提供用途として別ファイルで提供する。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageIntroCardProps {
  storageKey: string;
  title: string;
  steps: string[];
  learnMoreHref?: string;
  variant?: "info" | "muted";
}

const VARIANT_CLASSES: Record<
  NonNullable<PageIntroCardProps["variant"]>,
  string
> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  muted: "border-border bg-muted/40 text-foreground",
};

const VARIANT_TITLE_CLASSES: Record<
  NonNullable<PageIntroCardProps["variant"]>,
  string
> = {
  info: "text-blue-900",
  muted: "text-foreground",
};

const VARIANT_STEP_CLASSES: Record<
  NonNullable<PageIntroCardProps["variant"]>,
  string
> = {
  info: "text-blue-800",
  muted: "text-muted-foreground",
};

const VARIANT_DISMISS_CLASSES: Record<
  NonNullable<PageIntroCardProps["variant"]>,
  string
> = {
  info: "text-blue-700 hover:text-blue-900 hover:bg-blue-100",
  muted: "text-muted-foreground hover:text-foreground hover:bg-muted",
};

export function PageIntroCard({
  storageKey,
  title,
  steps,
  learnMoreHref,
  variant = "info",
}: PageIntroCardProps) {
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
      // localStorage が無効な環境ではフォールバック（表示する）
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
      // 永続化失敗時は無視（次回再表示される）
    }
  };

  return (
    <div className={cn("rounded-lg border p-4", VARIANT_CLASSES[variant])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p
            className={cn(
              "font-medium mb-2 text-sm",
              VARIANT_TITLE_CLASSES[variant],
            )}
          >
            {title}
          </p>
          <ol
            className={cn(
              "text-sm space-y-1 list-decimal list-inside mb-3",
              VARIANT_STEP_CLASSES[variant],
            )}
          >
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {learnMoreHref && (
            <Button variant="outline" size="sm" asChild>
              <Link href={learnMoreHref}>詳しい使い方を見る →</Link>
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          aria-label="このお知らせを閉じる"
          className={cn(
            "shrink-0 -mt-1 -mr-1",
            VARIANT_DISMISS_CLASSES[variant],
          )}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
