"use client";

import { StaffTable } from "@/components/staff-table";
import { ShiftSlotTable } from "@/components/shift-slot-table";
import { StaffingRequirementsTable } from "@/components/staffing-requirements-table";
import { SkillRequirementsTable } from "@/components/skill-requirements-table";
import { SolverConfigPanel } from "@/components/solver-config-panel";
import { HelpTip } from "@/components/ui/help-tip";
import { PageIntroCard } from "@/components/onboarding/page-intro-card";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          以下の順番で設定すると、スムーズにシフト作成を始められます。
        </p>
      </div>

      <PageIntroCard
        storageKey="intro:settings"
        title="設定画面の使い方"
        steps={[
          "スタッフを登録（必須）",
          "シフト枠を登録（必須・早番／遅番など）",
          "必要人数を設定（最低何人欲しいか）",
          "必要に応じてスキル要件・最適化の詳細を調整",
        ]}
      />

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

      <section>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
              +
            </span>
            <h2 className="text-xl font-semibold">スキル要件設定</h2>
            <HelpTip
              label="特定スキル保持者の最低配置を強制します。例: 『調理師免許保持者を早番に1名以上』。スタッフ側にスキルを設定したうえでお使いください。"
              srOnlyLabel="スキル要件設定の説明"
            />
          </div>
          <p className="text-sm text-muted-foreground ml-7">
            「調理師免許保持者を早番に1名以上」など、スキル・資格による配置条件を設定します。
            最適化設定で「スキル配置制約を有効にする」をオンにすると反映されます。
          </p>
        </div>
        <SkillRequirementsTable />
      </section>

      <section>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
              +
            </span>
            <h2 className="text-xl font-semibold">最適化の詳細設定</h2>
            <HelpTip
              label="動作確認できるまでは触らないことを推奨。プリセットで業種にあった既定値を一括適用できます。"
              srOnlyLabel="最適化の詳細設定の説明"
            />
          </div>
          <p className="text-sm text-muted-foreground ml-7">
            シフト自動作成の動作を細かく調整できます。
            <strong>初めての方はデフォルトのままで問題ありません。</strong>
          </p>
        </div>
        <SolverConfigPanel />
      </section>
    </div>
  );
}
