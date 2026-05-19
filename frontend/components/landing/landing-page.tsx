/**
 * ログイン前ランディングページ
 *
 * 未認証ユーザーがルート（/）にアクセスしたときに表示される紹介ページ。
 * 「AI による自動シフト割り当て」「無料・メールアドレスだけで開始」を主訴求点とし、
 * /signin への導線を明示する。
 *
 * サーバーコンポーネント（インタラクションなし）。app/layout.tsx は未認証時に
 * ヘッダーを描画しないため、ここではフルブリードのマーケティングビューになる。
 */
import Link from "next/link";
import { ArrowRight, Gift, MessageSquare, Scale, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI による自動シフト割り当て",
    description:
      "希望・必要人数・勤務ルールを満たすシフト表を、数十秒で自動生成します。",
  },
  {
    icon: MessageSquare,
    title: "スタッフ希望をオンラインで回収",
    description:
      "LINE などで URL を共有するだけ。紙やチャットでのやり取りが不要になります。",
  },
  {
    icon: Scale,
    title: "公平性・勤務ルールを自動チェック",
    description: "週の最大勤務日数や連勤、早遅シフトの偏りを自動で考慮します。",
  },
];

const STEPS = [
  {
    number: "1",
    title: "メールアドレスで登録",
    description:
      "パスワード不要。届いたリンクをクリックするだけで開始できます。",
  },
  {
    number: "2",
    title: "スタッフとシフト枠を登録",
    description: "スタッフの基本情報と、曜日ごとの必要人数を入力します。",
  },
  {
    number: "3",
    title: "最適化を実行 → 公開",
    description:
      "ボタン一つでシフト表を生成。スタッフは URL から確認できます。",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-blue-50/40 to-white">
      {/* Hero */}
      <section className="container mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
              <Gift className="size-3.5" aria-hidden />
              無料・メールアドレスだけで開始
            </Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            シフト作りに、もう
            <br className="sm:hidden" />
            何時間もかけない。
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            AI がスタッフの希望と必要人数を満たすシフトを自動で組みます。
            <br className="hidden sm:block" />
            小規模店舗のシフト管理を、もっとかんたんに。
          </p>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Button asChild size="lg" className="text-base">
              <Link href="/signin">
                無料で始める
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              クレジットカード不要・いつでも退会できます
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        aria-labelledby="features-heading"
        className="container mx-auto px-4 pb-20"
      >
        <h2
          id="features-heading"
          className="mb-10 text-center text-2xl font-bold sm:text-3xl"
        >
          シフトすけっとの特長
        </h2>
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-1 md:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="h-full">
                <CardHeader>
                  <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold leading-none">
                    {feature.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="how-it-works-heading"
        className="bg-blue-50/60 py-20"
      >
        <div className="container mx-auto px-4">
          <h2
            id="how-it-works-heading"
            className="mb-10 text-center text-2xl font-bold sm:text-3xl"
          >
            使い方は 3 ステップ
          </h2>
          <ol className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-1 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.number}
                className="flex flex-col items-start rounded-lg bg-white p-6 shadow-sm"
              >
                <div className="mb-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">
          シフト作成の手間を、今日から減らしませんか？
        </h2>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild size="lg" className="text-base">
            <Link href="/signin">
              今すぐ無料で始める
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            クレジットカード不要・いつでも退会できます
          </p>
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="container mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          シフトすけっと
        </div>
      </footer>
    </main>
  );
}
