"use client";

/**
 * オンボーディンググループ Error Boundary
 *
 * /onboarding/getting-started の fetchMeServer() が throw した場合（バックエンドダウン等）に
 * Next.js が自動的にこのコンポーネントを表示する。
 * error.tsx は Next.js の要件で "use client" が必須。
 */
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OnboardingError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // エラーをコンソールに記録する（本番では Sentry 等に送信予定）
    console.error("[OnboardingError]", error);
  }, [error]);

  return (
    <div className="w-full max-w-sm mx-4">
      <Card>
        <CardHeader>
          <CardTitle>エラーが発生しました</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ページの読み込みに失敗しました。しばらく待ってから再試行してください。
          </p>
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              再試行
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => signOut({ callbackUrl: "/signin" })}
            >
              ログアウト
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
