"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getNextMonthRange, getThisMonthRange } from "@/lib/date-helpers";
import type {
  Staff,
  ShiftSlot,
  SchedulePeriod,
  ScheduleAssignment,
  ScheduleResponse,
  OptimizeResponse,
  DiagnosticItem,
  StaffingRequirement,
  StaffRequest,
} from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShiftCalendar } from "@/components/shift-calendar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DiagnosticsPanel } from "@/components/diagnostics-panel";

export default function SchedulePage() {
  // Period management state
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(
    null
  );

  // New period form - default to next month
  const nextMonth = getNextMonthRange();
  const [newStartDate, setNewStartDate] = useState(nextMonth.start);
  const [newEndDate, setNewEndDate] = useState(nextMonth.end);
  const [creatingPeriod, setCreatingPeriod] = useState(false);

  // Schedule data
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staffRequests, setStaffRequests] = useState<StaffRequest[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [requirements, setRequirements] = useState<StaffingRequirement[]>([]);

  // Loading states
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);

  // Publish confirm dialog
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // Fetch all periods
  const fetchPeriods = useCallback(async () => {
    try {
      setLoadingPeriods(true);
      const data = await apiFetch<SchedulePeriod[]>("/api/schedules");
      setPeriods(data);
    } catch (e) {
      console.error(e);
      toast.error("スケジュール期間の取得に失敗しました");
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  // Fetch staff and shift slots (reference data)
  useEffect(() => {
    async function fetchReferenceData() {
      try {
        const [staffData, slotsData, reqData] = await Promise.all([
          apiFetch<Staff[]>("/api/staff"),
          apiFetch<ShiftSlot[]>("/api/shift-slots"),
          apiFetch<StaffingRequirement[]>("/api/staffing-requirements"),
        ]);
        setStaffList(staffData);
        setShiftSlots(slotsData);
        setRequirements(reqData);
      } catch (e) {
        console.error(e);
        toast.error("マスタデータの取得に失敗しました");
      }
    }
    fetchReferenceData();
    fetchPeriods();
  }, [fetchPeriods]);

  // Fetch schedule when period is selected
  const fetchSchedule = useCallback(async (periodId: string) => {
    if (!periodId) return;
    try {
      setLoadingSchedule(true);
      const [scheduleData, requestsData] = await Promise.all([
        apiFetch<ScheduleResponse>(`/api/schedules/${periodId}`),
        apiFetch<StaffRequest[]>(`/api/requests?period_id=${periodId}`),
      ]);
      setSelectedPeriod(scheduleData.period);
      setAssignments(scheduleData.assignments);
      setStaffRequests(requestsData);
    } catch (e) {
      console.error(e);
      toast.error("スケジュールの取得に失敗しました");
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchSchedule(selectedPeriodId);
      setDiagnostics([]);
    } else {
      setSelectedPeriod(null);
      setAssignments([]);
      setStaffRequests([]);
      setDiagnostics([]);
    }
  }, [selectedPeriodId, fetchSchedule]);

  // Create new period
  async function handleCreatePeriod() {
    if (!newStartDate || !newEndDate) {
      toast.error("開始日と終了日を入力してください");
      return;
    }
    if (newStartDate > newEndDate) {
      toast.error("開始日は終了日より前にしてください");
      return;
    }
    try {
      setCreatingPeriod(true);
      const created = await apiFetch<SchedulePeriod>("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          start_date: newStartDate,
          end_date: newEndDate,
        }),
      });
      const next = getNextMonthRange();
      setNewStartDate(next.start);
      setNewEndDate(next.end);
      await fetchPeriods();
      setSelectedPeriodId(String(created.id));
      toast.success("スケジュール期間を作成しました");
    } catch (e) {
      console.error(e);
      toast.error("スケジュール期間の作成に失敗しました");
    } finally {
      setCreatingPeriod(false);
    }
  }

  function handleQuickSelect(type: "thisMonth" | "nextMonth") {
    const range =
      type === "thisMonth" ? getThisMonthRange() : getNextMonthRange();
    setNewStartDate(range.start);
    setNewEndDate(range.end);
  }

  // Run optimization
  async function handleOptimize() {
    if (!selectedPeriodId) return;
    try {
      setOptimizing(true);
      setDiagnostics([]);
      const result = await apiFetch<OptimizeResponse>(
        `/api/schedules/${selectedPeriodId}/optimize`,
        { method: "POST" }
      );
      if (result.status === "optimal") {
        toast.success(`最適化が完了しました: ${result.message}`);
        setAssignments(result.assignments);
        setDiagnostics([]);
      } else {
        toast.error(`最適化に失敗しました: ${result.message}`);
        setDiagnostics(result.diagnostics || []);
      }
    } catch (e) {
      console.error(e);
      toast.error("最適化の実行に失敗しました");
    } finally {
      setOptimizing(false);
    }
  }

  // Publish
  async function handlePublish() {
    if (!selectedPeriodId) return;
    try {
      setPublishing(true);
      setPublishConfirmOpen(false);
      const updated = await apiFetch<SchedulePeriod>(
        `/api/schedules/${selectedPeriodId}/publish`,
        { method: "PUT" }
      );
      setSelectedPeriod(updated);
      setPeriods((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      toast.success("シフトを公開しました");
    } catch (e) {
      console.error(e);
      toast.error("公開に失敗しました");
    } finally {
      setPublishing(false);
    }
  }

  function handleAssignmentUpdated() {
    if (selectedPeriodId) {
      fetchSchedule(selectedPeriodId);
    }
  }

  const isDraft = selectedPeriod?.status === "draft";
  const hasAssignments = assignments.length > 0;

  const isSetupIncomplete = !loadingPeriods && (staffList.length === 0 || shiftSlots.length === 0);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">シフト表</h1>

      {/* Onboarding banner */}
      {isSetupIncomplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">はじめに設定が必要です</p>
          <p className="mb-2">シフト表を作成する前に、次の順番で設定してください：</p>
          <ol className="list-decimal list-inside space-y-1 mb-3">
            <li className={staffList.length > 0 ? "line-through text-amber-500" : ""}>
              スタッフを登録する
            </li>
            <li className={shiftSlots.length > 0 ? "line-through text-amber-500" : ""}>
              シフト枠を登録する（例: 早番・遅番）
            </li>
            <li>必要人数を設定する</li>
            <li>希望入力でスタッフの希望を収集する</li>
          </ol>
          <Link href="/settings">
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100">
              設定画面へ →
            </Button>
          </Link>
        </div>
      )}

      {/* Period Management */}
      <Card>
        <CardHeader>
          <CardTitle>スケジュール期間</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new period */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-sm font-medium">開始日</label>
              <Input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">終了日</label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("thisMonth")}
              >
                今月
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("nextMonth")}
              >
                来月
              </Button>
            </div>
            <Button onClick={handleCreatePeriod} disabled={creatingPeriod}>
              {creatingPeriod && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              期間を作成
            </Button>
          </div>

          {/* Select existing period */}
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">期間を選択</label>
              {loadingPeriods ? (
                <p className="text-sm text-muted-foreground">読み込み中...</p>
              ) : (
                <Select
                  value={selectedPeriodId}
                  onValueChange={setSelectedPeriodId}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="スケジュール期間を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={String(period.id)}>
                        {period.start_date} ~ {period.end_date}{" "}
                        ({period.status === "draft" ? "下書き" : "公開済み"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Period status and actions */}
          {selectedPeriod && (
            <div className="flex items-center gap-4 pt-2">
              {isDraft ? (
                <Badge variant="secondary">下書き</Badge>
              ) : (
                <Badge>公開済み</Badge>
              )}

              <Button
                onClick={handleOptimize}
                disabled={!isDraft || optimizing}
              >
                {optimizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {optimizing ? "計算中..." : "最適化実行"}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setPublishConfirmOpen(true)}
                disabled={!isDraft || !hasAssignments || publishing}
              >
                {publishing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                公開
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostics Panel */}
      {diagnostics.length > 0 && <DiagnosticsPanel diagnostics={diagnostics} />}

      {/* Shift Calendar */}
      {selectedPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>
              シフトカレンダー ({selectedPeriod.start_date} ~{" "}
              {selectedPeriod.end_date})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Optimizing overlay */}
              {optimizing && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 rounded-lg border bg-white px-8 py-6 shadow-md">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">シフトを計算しています...</p>
                    <p className="text-xs text-muted-foreground">最大 30 秒かかる場合があります</p>
                  </div>
                </div>
              )}

              {loadingSchedule ? (
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
                  isPublished={selectedPeriod.status === "published"}
                  onAssignmentUpdated={handleAssignmentUpdated}
                />
              )}

              {/* Legend */}
              {shiftSlots.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <span className="font-medium text-gray-600">凡例:</span>
                  {shiftSlots.map((slot, index) => {
                    const colors = [
                      "bg-blue-100 text-blue-800",
                      "bg-green-100 text-green-800",
                      "bg-yellow-100 text-yellow-800",
                      "bg-purple-100 text-purple-800",
                      "bg-pink-100 text-pink-800",
                    ];
                    const colorClass = colors[index % colors.length];
                    return (
                      <span
                        key={slot.id}
                        className={`inline-flex items-center px-2 py-0.5 rounded ${colorClass}`}
                      >
                        {slot.name}
                      </span>
                    );
                  })}
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-gray-400">
                    - (休み)
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded ring-2 ring-orange-400 text-orange-600">
                    手動編集
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publish confirm dialog */}
      <ConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="シフトの公開"
        description="シフトを公開しますか？公開後は編集できなくなります。"
        onConfirm={handlePublish}
      />
    </div>
  );
}
