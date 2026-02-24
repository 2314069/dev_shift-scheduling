"use client";

import { StaffTable } from "@/components/staff-table";
import { ShiftSlotTable } from "@/components/shift-slot-table";
import { StaffingRequirementsTable } from "@/components/staffing-requirements-table";
import { SolverConfigPanel } from "@/components/solver-config-panel";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          以下の順番で設定すると、スムーズにシフト作成を始められます。
        </p>
      </div>

      <section>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center">1</span>
            <h2 className="text-xl font-semibold">スタッフ管理</h2>
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
            <span className="text-xs font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center">2</span>
            <h2 className="text-xl font-semibold">シフト枠管理</h2>
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
            <span className="text-xs font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center">3</span>
            <h2 className="text-xl font-semibold">必要人数設定</h2>
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
            <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">+</span>
            <h2 className="text-xl font-semibold">最適化の詳細設定</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-7">
            シフト自動作成の動作を細かく調整できます。<strong>初めての方はデフォルトのままで問題ありません。</strong>
          </p>
        </div>
        <SolverConfigPanel />
      </section>
    </div>
  );
}
