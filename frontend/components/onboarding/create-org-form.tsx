"use client";

/**
 * 店舗作成フォーム
 *
 * /onboarding ページで使用するクライアントコンポーネント。
 * createOrganization() を呼び、成功・409「既所有」のとき onSuccess() を呼び出す。
 * slug 衝突・422・ネットワークエラーはインライン Alert で表示する。
 */
import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { createOrganization, ApiError } from "@/lib/api";

interface CreateOrgFormProps {
  /**
   * フォーム送信成功時（または 409「既所有」時）のコールバック。
   * ページ側で router.push("/onboarding/getting-started") を呼ぶ。
   */
  onSuccess: () => void;
}

export function CreateOrgForm({ onSuccess }: CreateOrgFormProps) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validateName(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return "店舗名を入力してください";
    if (trimmed.length > 100) return "店舗名は100文字以内で入力してください";
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }
    setNameError(null);

    startTransition(async () => {
      try {
        await createOrganization({ name: name.trim() });
        onSuccess();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          if (err.detail === "You already own an organization") {
            // 既所有 → getting-started へ（成功と同じ扱い）
            onSuccess();
            return;
          }
          // slug 衝突
          setServerError("もう一度お試しください");
        } else if (err instanceof ApiError && err.status === 422) {
          setServerError("入力内容を確認してください");
        } else {
          setServerError(
            "通信エラーが発生しました。しばらくしてから再試行してください",
          );
        }
      }
    });
  }

  return (
    <div className="w-full max-w-sm mx-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">シフトすけっと</h1>
        <p className="text-sm text-muted-foreground mt-2">
          スタッフのシフトを、かんたんに作成できます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>お店を登録しましょう</CardTitle>
          <CardDescription>
            店舗名を入力すると、シフト管理を始められます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serverError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">店舗名</Label>
                <Input
                  id="org-name"
                  type="text"
                  placeholder="例: 渋谷カフェ 本店"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  autoFocus
                  disabled={isPending}
                  aria-describedby={
                    nameError ? "org-name-error" : "org-name-hint"
                  }
                  aria-invalid={!!nameError}
                  aria-required="true"
                />
                {nameError ? (
                  <p
                    id="org-name-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {nameError}
                  </p>
                ) : (
                  <p
                    id="org-name-hint"
                    className="text-xs text-muted-foreground"
                  >
                    あとから変更できます
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登録中...
                  </>
                ) : (
                  "お店を登録して始める"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="text-sm text-muted-foreground hover:underline"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
