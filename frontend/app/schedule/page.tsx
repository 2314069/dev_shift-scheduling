"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  Staff,
  ShiftSlot,
  SchedulePeriod,
  ScheduleAssignment,
  ScheduleResponse,
  OptimizeResponse,
} from "@/lib/types";
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
import { ShiftCalendar } from "@/components/shift-calendar";

export default function SchedulePage() {
  // Period management state
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(
    null
  );

  // New period form
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [creatingPeriod, setCreatingPeriod] = useState(false);

  // Schedule data
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);

  // Loading states
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Messages
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch all periods
  const fetchPeriods = useCallback(async () => {
    try {
      setLoadingPeriods(true);
      const data = await apiFetch<SchedulePeriod[]>("/api/schedules");
      setPeriods(data);
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "スケジュール期間の取得に失敗しました" });
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  // Fetch staff and shift slots (reference data)
  useEffect(() => {
    async function fetchReferenceData() {
      try {
        const [staffData, slotsData] = await Promise.all([
          apiFetch<Staff[]>("/api/staff"),
          apiFetch<ShiftSlot[]>("/api/shift-slots"),
        ]);
        setStaffList(staffData);
        setShiftSlots(slotsData);
      } catch (e) {
        console.error(e);
        setMessage({
          type: "error",
          text: "マスタデータの取得に失敗しました",
        });
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
      const data = await apiFetch<ScheduleResponse>(
        `/api/schedules/${periodId}`
      );
      setSelectedPeriod(data.period);
      setAssignments(data.assignments);
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "スケジュールの取得に失敗しました" });
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchSchedule(selectedPeriodId);
    } else {
      setSelectedPeriod(null);
      setAssignments([]);
    }
  }, [selectedPeriodId, fetchSchedule]);

  // Create new period
  async function handleCreatePeriod() {
    if (!newStartDate || !newEndDate) {
      setMessage({ type: "error", text: "開始日と終了日を入力してください" });
      return;
    }
    if (newStartDate > newEndDate) {
      setMessage({ type: "error", text: "開始日は終了日より前にしてください" });
      return;
    }
    try {
      setCreatingPeriod(true);
      setMessage(null);
      const created = await apiFetch<SchedulePeriod>("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          start_date: newStartDate,
          end_date: newEndDate,
        }),
      });
      setNewStartDate("");
      setNewEndDate("");
      await fetchPeriods();
      setSelectedPeriodId(String(created.id));
      setMessage({ type: "success", text: "スケジュール期間を作成しました" });
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "スケジュール期間の作成に失敗しました" });
    } finally {
      setCreatingPeriod(false);
    }
  }

  // Run optimization
  async function handleOptimize() {
    if (!selectedPeriodId) return;
    try {
      setOptimizing(true);
      setMessage(null);
      const result = await apiFetch<OptimizeResponse>(
        `/api/schedules/${selectedPeriodId}/optimize`,
        { method: "POST" }
      );
      if (result.status === "optimal") {
        setMessage({
          type: "success",
          text: `最適化が完了しました: ${result.message}`,
        });
        setAssignments(result.assignments);
      } else {
        setMessage({
          type: "error",
          text: `最適化に失敗しました: ${result.message}`,
        });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "最適化の実行に失敗しました" });
    } finally {
      setOptimizing(false);
    }
  }

  // Publish
  async function handlePublish() {
    if (!selectedPeriodId) return;
    if (!window.confirm("シフトを公開しますか？公開後は編集できなくなります。")) {
      return;
    }
    try {
      setPublishing(true);
      setMessage(null);
      const updated = await apiFetch<SchedulePeriod>(
        `/api/schedules/${selectedPeriodId}/publish`,
        { method: "PUT" }
      );
      setSelectedPeriod(updated);
      // Update the period in the list
      setPeriods((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setMessage({ type: "success", text: "シフトを公開しました" });
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "公開に失敗しました" });
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">シフト表</h1>

      {/* Message display */}
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Period Management */}
      <Card>
        <CardHeader>
          <CardTitle>スケジュール期間</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new period */}
          <div className="flex items-end gap-4">
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
            <Button onClick={handleCreatePeriod} disabled={creatingPeriod}>
              {creatingPeriod ? "作成中..." : "期間を作成"}
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
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isDraft
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {isDraft ? "下書き" : "公開済み"}
              </span>

              <Button
                onClick={handleOptimize}
                disabled={!isDraft || optimizing}
              >
                {optimizing ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    最適化実行中...
                  </span>
                ) : (
                  "最適化実行"
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={handlePublish}
                disabled={!isDraft || !hasAssignments || publishing}
              >
                {publishing ? "公開中..." : "公開"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
