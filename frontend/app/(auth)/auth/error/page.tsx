import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "ログインエラー | シフトすけっと",
};

const ERROR_MESSAGES: Record<string, string> = {
  Verification:
    "ログインリンクの有効期限が切れています。もう一度メールを送信してください。",
  AccessDenied:
    "このアカウントはアクセスが制限されています。管理者にお問い合わせください。",
  Configuration:
    "システムの設定に問題が発生しました。しばらく時間を置いてから再試行してください。",
};

const DEFAULT_ERROR_MESSAGE =
  "ログイン中にエラーが発生しました。もう一度お試しください。";

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { error } = await searchParams;
  const message = (error && ERROR_MESSAGES[error]) ?? DEFAULT_ERROR_MESSAGE;

  return (
    <div className="w-full max-w-sm mx-4">
      <Card>
        <CardHeader>
          <CardTitle>ログインできませんでした</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button className="w-full" autoFocus asChild>
            <Link href="/signin">もう一度ログインする</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
