/**
 * 初期データガイド チェックリスト
 *
 * サーバーコンポーネント。onboarding の counts を受け取り各ステップの完了状態を表示する。
 * UI 設計書 §4.2 の仕様に従う。
 */
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NextActionsCard } from "@/components/onboarding/next-actions-card";

interface GettingStartedChecklistProps {
  staffCount: number;
  shiftSlotCount: number;
  isComplete: boolean;
}

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  completedButtonLabel?: string;
  isCompleted: boolean;
  isOptional?: boolean;
  isAlwaysIncomplete?: boolean;
}

function StepCard({
  stepNumber,
  title,
  description,
  href,
  buttonLabel,
  completedButtonLabel,
  isCompleted,
  isOptional = false,
  isAlwaysIncomplete = false,
}: StepCardProps) {
  const completed = isCompleted && !isAlwaysIncomplete;

  return (
    <li
      aria-label={`ステップ ${stepNumber}: ${title}（${completed ? "完了" : "未完了"}）`}
      className={
        completed
          ? "border border-border rounded-lg p-4 space-y-2 bg-gray-50 opacity-75"
          : "border border-border rounded-lg p-4 space-y-2"
      }
    >
      <div className="flex items-center gap-2">
        {completed ? (
          <span
            className="text-xs font-bold bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            ✓
          </span>
        ) : (
          <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center shrink-0">
            {stepNumber}
          </span>
        )}
        <span className="text-sm font-medium">{title}</span>
        {isOptional && (
          <Badge variant="secondary" className="text-xs">
            任意
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground pl-7">{description}</p>
      <div className="pl-7">
        <Button variant={completed ? "ghost" : "outline"} size="sm" asChild>
          <Link href={href}>
            {completed && completedButtonLabel
              ? completedButtonLabel
              : buttonLabel}
          </Link>
        </Button>
      </div>
    </li>
  );
}

export function GettingStartedChecklist({
  staffCount,
  shiftSlotCount,
  isComplete,
}: GettingStartedChecklistProps) {
  return (
    <div className="w-full max-w-md mx-4">
      <Card>
        <CardHeader>
          <CardTitle>はじめましょう！</CardTitle>
          <CardDescription>
            4つのステップでシフト作成が始められます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-3">
            <StepCard
              stepNumber={1}
              title="スタッフを登録する"
              description="シフトに入るスタッフを追加します。"
              href="/settings"
              buttonLabel="設定画面へ →"
              completedButtonLabel="再設定する →"
              isCompleted={staffCount > 0}
            />
            <StepCard
              stepNumber={2}
              title="シフト枠を登録する"
              description="早番・遅番などの時間帯を登録します。"
              href="/settings"
              buttonLabel="設定画面へ →"
              completedButtonLabel="再設定する →"
              isCompleted={shiftSlotCount > 0}
            />
            <StepCard
              stepNumber={3}
              title="必要人数を設定する"
              description="各シフト枠の最低必要人数を設定します。"
              href="/settings"
              buttonLabel="設定画面へ →"
              isCompleted={false}
              isOptional={true}
              isAlwaysIncomplete={true}
            />
            <StepCard
              stepNumber={4}
              title="最初のシフトを作成する"
              description="最適化を実行してシフトを自動生成します。"
              href="/schedule"
              buttonLabel="シフト表へ →"
              isCompleted={false}
              isAlwaysIncomplete={true}
            />
          </ol>

          <Separator />

          {isComplete ? (
            <div className="space-y-3">
              <p className="text-sm text-center font-medium">
                準備が整いました！シフト表でシフトを作成できます。
              </p>
              <Button asChild className="w-full">
                <Link href="/schedule">シフト表を開く</Link>
              </Button>
              <NextActionsCard />
            </div>
          ) : (
            <Button
              variant="ghost"
              asChild
              className="mt-2 w-full text-muted-foreground"
            >
              <Link href="/schedule">あとで設定する</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-center">
        <SignOutLink />
      </div>
    </div>
  );
}
