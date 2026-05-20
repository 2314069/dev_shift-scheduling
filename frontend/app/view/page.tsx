"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  Staff,
  ShiftSlot,
  SchedulePeriod,
  ScheduleAssignment,
  ScheduleResponse,
  StaffingRequirement,
  StaffRequest,
} from "@/lib/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftCalendar } from "@/components/shift-calendar";
import { PageIntroCard } from "@/components/onboarding/page-intro-card";
import { HelpTip } from "@/components/ui/help-tip";
import { CalendarX } from "lucide-react";

export default function ViewPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [requirements, setRequirements] = useState<StaffingRequirement[]>([]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staffRequests, setStaffRequests] = useState<StaffRequest[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [staffData, slotsData, periodsData, reqData] = await Promise.all([
          apiFetch<Staff[]>("/api/staff"),
          apiFetch<ShiftSlot[]>("/api/shift-slots"),
          apiFetch<SchedulePeriod[]>("/api/schedules"),
          apiFetch<StaffingRequirement[]>("/api/staffing-requirements"),
        ]);
        setStaffList(staffData);
        setShiftSlots(slotsData);
        setPeriods(periodsData.filter((p) => p.status === "published"));
        setRequirements(reqData);
      } catch (e) {
        console.error(e);
        toast.error("データの取得に失敗しました");
      }
    }
    fetchData();
  }, []);

  const fetchSchedule = useCallback(async (periodId: string) => {
    if (!periodId) return;
    try {
      setLoading(true);
      const [scheduleData, requestsData] = await Promise.all([
        apiFetch<ScheduleResponse>(`/api/schedules/${periodId}`),
        apiFetch<StaffRequest[]>(`/api/requests?period_id=${periodId}`),
      ]);
      setSelectedPeriod(scheduleData.period);
      setAssignments(scheduleData.assignments);
      setStaffRequests(requestsData);
    } catch (e) {
      console.error(e);
      toast.error("シフト表の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchSchedule(selectedPeriodId);
    } else {
      setSelectedPeriod(null);
      setAssignments([]);
      setStaffRequests([]);
    }
  }, [selectedPeriodId, fetchSchedule]);

  const highlightStaffId = selectedStaffId
    ? Number(selectedStaffId)
    : undefined;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">シフト確認</h1>

      <PageIntroCard
        storageKey="intro:view"
        title="シフト確認の使い方"
        steps={[
          "「自分の名前」を選ぶと、自分のセルがハイライトされます",
          "「期間」を選ぶと、その期間の公開済みシフトが表示されます",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>表示設定</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium inline-flex items-center gap-1">
              自分の名前
              <HelpTip
                label="選ぶと、その人が割り当てられたセルが強調表示されます。"
                srOnlyLabel="自分の名前の説明"
              />
            </label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium inline-flex items-center gap-1">
              期間
              <HelpTip
                label="公開済みのシフト期間のみ選択できます。下書きは管理者の画面で確認します。"
                srOnlyLabel="期間の説明"
              />
            </label>
            <Select
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="期間を選択（公開済みのみ）" />
              </SelectTrigger>
              <SelectContent>
                {periods.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    公開済みのシフトがありません
                  </SelectItem>
                ) : (
                  periods.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.start_date} 〜 {p.end_date}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>
              シフト表 ({selectedPeriod.start_date} 〜 {selectedPeriod.end_date}
              )
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : (
              <ShiftCalendar
                periodId={selectedPeriod.id}
                startDate={selectedPeriod.start_date}
                endDate={selectedPeriod.end_date}
                staffList={staffList}
                shiftSlots={shiftSlots}
                assignments={assignments}
                requirements={requirements}
                staffRequests={staffRequests}
                isPublished={true}
                onAssignmentUpdated={() => {}}
                highlightStaffId={highlightStaffId}
              />
            )}
          </CardContent>
        </Card>
      )}

      {!selectedPeriod && periods.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <CalendarX className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-1">
            まだ公開されたシフトがありません
          </p>
          <p className="text-sm text-muted-foreground">
            管理者がシフトを公開すると、ここで日別の割り当てが確認できます。
          </p>
        </div>
      )}
    </div>
  );
}
