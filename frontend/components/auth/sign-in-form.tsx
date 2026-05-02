"use client";

/**
 * メールアドレス入力フォーム
 *
 * サーバーコンポーネントの /signin ページから分離することで、
 * "use client" の境界を最小化する。
 */
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
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

interface SignInFormProps {
  callbackUrl?: string;
}

export function SignInForm({ callbackUrl = "/schedule" }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validateEmail(value: string): string | null {
    if (!value) return "メールアドレスを入力してください";
    // 簡易フォーマット検証
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "正しいメールアドレスを入力してください";
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError(null);

    startTransition(async () => {
      try {
        await signIn("nodemailer", {
          email,
          redirectTo: callbackUrl,
        });
      } catch (err) {
        // Auth.js v5 は signIn 成功時にリダイレクト例外を throw することがある
        // NEXT_REDIRECT はリダイレクト正常系なので無視する
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
          return;
        }
        if (err instanceof Error && err.message.includes("429")) {
          setServerError(
            "送信回数の上限に達しました。10分後に再試行してください",
          );
        } else {
          setServerError(
            "メールの送信に失敗しました。しばらくしてから再試行してください",
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
          小規模店舗のシフト作成を、もっとかんたんに。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ログイン / 新規登録</CardTitle>
          <CardDescription>
            メールアドレスを入力すると、ログイン用のリンクをお送りします。パスワードは不要です。
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
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  disabled={isPending}
                  aria-describedby={emailError ? "email-error" : undefined}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p id="email-error" className="text-sm text-destructive">
                    {emailError}
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
                    送信中...
                  </>
                ) : (
                  "ログインリンクを送る"
                )}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-4">
            送信することで、利用規約とプライバシーポリシーに同意したものとみなします。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
