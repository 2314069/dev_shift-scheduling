"use client";

import { StaffTable } from "@/components/staff-table";
import { ShiftSlotTable } from "@/components/shift-slot-table";
import { StaffingRequirementsTable } from "@/components/staffing-requirements-table";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold">設定</h1>
      <section>
        <h2 className="text-xl font-semibold mb-4">スタッフ管理</h2>
        <StaffTable />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">シフト枠管理</h2>
        <ShiftSlotTable />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">必要人数設定</h2>
        <StaffingRequirementsTable />
      </section>
    </div>
  );
}
