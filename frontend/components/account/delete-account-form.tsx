"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccount } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CONFIRMATION_PHRASE = "アカウントを削除する";

export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit = confirmation === CONFIRMATION_PHRASE && !isPending;

  function handleDelete() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        await deleteAccount();
        toast.success("アカウントを削除しました");
        await signOut({ callbackUrl: "/signin" });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "削除に失敗しました。時間をおいて再度お試しください。";
        toast.error(message);
      }
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">アカウント削除</CardTitle>
        <CardDescription>
          このアカウントと、所有しているすべての店舗データを完全に削除します。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Alert variant="destructive">
          <AlertTitle>削除すると元に戻せません</AlertTitle>
          <AlertDescription>
            あなたが所有する店舗（owner）に紐づく以下のデータがすべて削除されます:
            スタッフ・シフト枠・必要人数設定・希望入力・確定スケジュール・最適化履歴。
            削除後はバックアップからの復旧もできません。
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="confirmation">
            確認のため「{CONFIRMATION_PHRASE}」と入力してください
          </Label>
          <Input
            id="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRMATION_PHRASE}
            disabled={isPending}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" asChild disabled={isPending}>
            <a href="/schedule">キャンセル</a>
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={handleDelete}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            アカウントを完全に削除する
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
