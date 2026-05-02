import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "メールを確認してください | シフトすけっと",
};

interface VerifyRequestPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyRequestPage({
  searchParams,
}: VerifyRequestPageProps) {
  const { email } = await searchParams;

  return (
    <div className="w-full max-w-sm mx-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Mail className="h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold">メールを送信しました</h1>
            <p className="text-sm text-muted-foreground">
              {email ? (
                <>
                  <span className="font-medium text-foreground">{email}</span>{" "}
                  にログインリンクをお送りしました。
                </>
              ) : (
                "ご登録のメールアドレスにログインリンクをお送りしました。"
              )}
              <br />
              メールを開いてリンクをクリックしてください。
            </p>

            <Separator />

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
              <Link
                href="/signin"
                className="text-sm text-primary underline hover:no-underline"
              >
                別のメールアドレスで試す
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
