"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StaffTable } from "@/components/staff-table";
import { ShiftSlotTable } from "@/components/shift-slot-table";
import { StaffingRequirementsTable } from "@/components/staffing-requirements-table";
import { SkillRequirementsTable } from "@/components/skill-requirements-table";
import { SolverConfigPanel } from "@/components/solver-config-panel";
import { HelpTip } from "@/components/ui/help-tip";
import { PageIntroCard } from "@/components/onboarding/page-intro-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type TabValue = "basic" | "skills" | "optimizer";

const VALID_TABS: TabValue[] = ["basic", "skills", "optimizer"];

function isValidTab(value: string | null): value is TabValue {
  return value !== null && (VALID_TABS as string[]).includes(value);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // URL を真実の源とし、ローカル state は持たない（useEffect の同期を避ける）。
  const activeTab: TabValue = isValidTab(tabParam) ? tabParam : "basic";

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isValidTab(value)) return;
      // 履歴を汚さず URL を書き換える。ディープリンク用途のみが目的。
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          タブで分類されています。「基本設定」を順に埋めると、シフト作成を始められます。
        </p>
      </div>

      <PageIntroCard
        storageKey="intro:settings"
        title="設定画面の使い方"
        steps={[
          "「基本設定」タブで スタッフ → シフト枠 → 必要人数 の順に登録（必須）",
          "必要に応じて「スキル要件」タブで配置条件を設定",
          "「最適化詳細」タブで動作を調整（初めは触らないで OK）",
        ]}
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full gap-6"
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="basic">基本設定</TabsTrigger>
          <TabsTrigger value="skills">
            スキル要件
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              任意
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="optimizer">
            最適化詳細
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              任意
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-10">
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center">
                  1
                </span>
                <h2 className="text-xl font-semibold">スタッフ管理</h2>
                <HelpTip
                  label="希望入力ページ (/staff?id=N) のリンクをスタッフに共有することで、各人がシフト希望を提出できるようになります。"
                  srOnlyLabel="スタッフ管理の説明"
                />
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                シフトに入るスタッフを登録します。名前と週の最大勤務日数を設定してください。
              </p>
            </div>
            <StaffTable />
          </section>

          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xl font-semibold">シフト枠管理</h2>
                <HelpTip
                  label="『早番 9:00–14:00』『遅番 14:00–22:00』のような時間帯ごとの枠を定義します。枠は最適化の最小単位になります。"
                  srOnlyLabel="シフト枠管理の説明"
                />
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                早番・遅番・通しなど、時間帯ごとのシフトの種類を登録します。
              </p>
            </div>
            <ShiftSlotTable />
          </section>

          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center">
                  3
                </span>
                <h2 className="text-xl font-semibold">必要人数設定</h2>
                <HelpTip
                  label="平日／休日それぞれ最低何人必要かを設定します。守れない場合は最適化が失敗するので、まずは無理のない人数から設定してください。"
                  srOnlyLabel="必要人数設定の説明"
                />
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                各シフト枠に「最低何人必要か」を設定します。この人数を満たすようにシフトが作成されます。
              </p>
            </div>
            <StaffingRequirementsTable />
          </section>
        </TabsContent>

        <TabsContent value="skills">
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold">スキル要件設定</h2>
                <HelpTip
                  label="特定スキル保持者の最低配置を強制します。例: 『調理師免許保持者を早番に1名以上』。スタッフ側にスキルを設定したうえでお使いください。"
                  srOnlyLabel="スキル要件設定の説明"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                「調理師免許保持者を早番に1名以上」など、スキル・資格による配置条件を設定します。
                最適化設定で「スキル配置制約を有効にする」をオンにすると反映されます。
              </p>
            </div>
            <SkillRequirementsTable />
          </section>
        </TabsContent>

        <TabsContent value="optimizer">
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold">最適化の詳細設定</h2>
                <HelpTip
                  label="動作確認できるまでは触らないことを推奨。プリセットで業種にあった既定値を一括適用できます。"
                  srOnlyLabel="最適化の詳細設定の説明"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                シフト自動作成の動作を細かく調整できます。
                <strong>初めての方はデフォルトのままで問題ありません。</strong>
              </p>
            </div>
            <SolverConfigPanel />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
