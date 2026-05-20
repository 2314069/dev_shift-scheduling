/**
 * オンボーディング完了後の「次にやること」を提示するカード。
 *
 * GettingStartedChecklist が is_complete=true になったときに表示される。
 * 店舗管理者が「初期設定は終わったが次に何をすればいいか」を迷わないよう、
 * 公開までの主要 3 アクションを提示する。
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface NextAction {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
}

const NEXT_ACTIONS: NextAction[] = [
  {
    title: "スタッフに希望入力ページを共有する",
    description:
      "スタッフ別の希望入力URL (/staff?id=N) をLINEなどで共有しましょう。",
    href: "/staff",
    buttonLabel: "スタッフ画面へ",
  },
  {
    title: "スケジュール期間を作成する",
    description: "シフトを作る対象期間（月単位を推奨）を作成します。",
    href: "/schedule",
    buttonLabel: "シフト表へ",
  },
  {
    title: "最適化を実行してシフトを公開する",
    description:
      "希望が集まったらAIで自動割り当て。確認してから「公開」を押すとスタッフが確認できるようになります。",
    href: "/schedule",
    buttonLabel: "シフト表へ",
  },
];

export function NextActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">次にやること</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {NEXT_ACTIONS.map((action, index) => (
            <li
              key={action.title}
              className="border border-border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <span
                  className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </p>
                </div>
              </div>
              <div className="pl-7">
                <Button variant="outline" size="sm" asChild>
                  <Link href={action.href}>
                    {action.buttonLabel}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
