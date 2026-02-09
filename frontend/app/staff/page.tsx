"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type {
  Staff,
  ShiftSlot,
  StaffRequest,
  SchedulePeriod,
  ScheduleResponse,
  ScheduleAssignment,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestCalendar, RequestEntry } from "@/components/request-calendar";

function StaffPageContent() {
  const searchParams = useSearchParams();
  const staffIdParam = searchParams.get("id");
  const periodIdParam = searchParams.get("period_id");

  // Staff state
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);

  // Period state
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    periodIdParam || ""
  );
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(
    null
  );
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  // Shift slots
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);

  // Requests
  const [existingRequests, setExistingRequests] = useState<StaffRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<
    Map<string, RequestEntry>
  >(new Map());
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Published schedule
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch staff list
  useEffect(() => {
    async function fetchStaff() {
      try {
        setLoadingStaff(true);
        const data = await apiFetch<Staff[]>("/api/staff");
        setStaffList(data);

        // If staffIdParam is present, find the staff member
        if (staffIdParam) {
          const found = data.find((s) => s.id === Number(staffIdParam));
          if (found) {
            setSelectedStaff(found);
          }
        }
      } catch (e) {
        console.error(e);
        setMessage({ type: "error", text: "スタッフ情報の取得に失敗しました" });
      } finally {
        setLoadingStaff(false);
      }
    }
    fetchStaff();
  }, [staffIdParam]);

  // Fetch periods and shift slots
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingPeriods(true);
        const [periodsData, slotsData] = await Promise.all([
          apiFetch<SchedulePeriod[]>("/api/schedules"),
          apiFetch<ShiftSlot[]>("/api/shift-slots"),
        ]);
        setPeriods(periodsData);
        setShiftSlots(slotsData);
      } catch (e) {
        console.error(e);
        setMessage({ type: "error", text: "データの取得に失敗しました" });
      } finally {
        setLoadingPeriods(false);
      }
    }
    fetchData();
  }, []);

  // Fetch schedule and requests when period is selected
  const fetchScheduleAndRequests = useCallback(
    async (periodId: string, staffId: number) => {
      try {
        setLoadingRequests(true);
        const [scheduleData, requestsData] = await Promise.all([
          apiFetch<ScheduleResponse>(`/api/schedules/${periodId}`),
          apiFetch<StaffRequest[]>(
            `/api/requests?period_id=${periodId}&staff_id=${staffId}`
          ),
        ]);

        setSelectedPeriod(scheduleData.period);
        setAssignments(
          scheduleData.assignments.filter((a) => a.staff_id === staffId)
        );
        setExistingRequests(requestsData);

        // Initialize pending requests from existing
        const map = new Map<string, RequestEntry>();
        for (const req of requestsData) {
          map.set(req.date, {
            type: req.type,
            shift_slot_id: req.shift_slot_id,
          });
        }
        setPendingRequests(map);
      } catch (e) {
        console.error(e);
        setMessage({
          type: "error",
          text: "スケジュールまたは希望情報の取得に失敗しました",
        });
      } finally {
        setLoadingRequests(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedPeriodId && selectedStaff) {
      fetchScheduleAndRequests(selectedPeriodId, selectedStaff.id);
    } else {
      setSelectedPeriod(null);
      setExistingRequests([]);
      setAssignments([]);
      setPendingRequests(new Map());
    }
  }, [selectedPeriodId, selectedStaff, fetchScheduleAndRequests]);

  // Handle request changes from the calendar
  function handleRequestsChange(requests: Map<string, RequestEntry>) {
    setPendingRequests(requests);
  }

  // Submit requests
  async function handleSubmit() {
    if (!selectedStaff || !selectedPeriodId) return;

    try {
      setSubmitting(true);
      setMessage(null);

      const requestItems = Array.from(pendingRequests.entries()).map(
        ([date, entry]) => ({
          staff_id: selectedStaff.id,
          date,
          shift_slot_id: entry.shift_slot_id,
          type: entry.type,
        })
      );

      await apiFetch<StaffRequest[]>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          period_id: Number(selectedPeriodId),
          requests: requestItems,
        }),
      });

      setMessage({ type: "success", text: "希望を提出しました" });

      // Refresh existing requests
      const updatedRequests = await apiFetch<StaffRequest[]>(
        `/api/requests?period_id=${selectedPeriodId}&staff_id=${selectedStaff.id}`
      );
      setExistingRequests(updatedRequests);
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "希望の提出に失敗しました" });
    } finally {
      setSubmitting(false);
    }
  }

  function getSlotName(slotId: number | null): string {
    if (slotId === null) return "休み";
    const slot = shiftSlots.find((s) => s.id === slotId);
    return slot ? slot.name : `ID:${slotId}`;
  }

  // If loading staff
  if (loadingStaff) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  // If no staff id provided, show staff selection list
  if (!staffIdParam && !selectedStaff) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <h1 className="text-2xl font-bold">スタッフ希望入力</h1>
        <Card>
          <CardHeader>
            <CardTitle>スタッフを選択してください</CardTitle>
          </CardHeader>
          <CardContent>
            {staffList.length === 0 ? (
              <p className="text-muted-foreground">
                スタッフが登録されていません。設定画面から追加してください。
              </p>
            ) : (
              <div className="space-y-2">
                {staffList.map((staff) => (
                  <a
                    key={staff.id}
                    href={`/staff?id=${staff.id}${periodIdParam ? `&period_id=${periodIdParam}` : ""}`}
                    className="block p-3 border rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="font-medium">{staff.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {staff.role} / 最大{staff.max_days_per_week}日/週
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPublished = selectedPeriod?.status === "published";
  const hasChanges =
    pendingRequests.size !== existingRequests.length ||
    Array.from(pendingRequests.entries()).some(([date, entry]) => {
      const existing = existingRequests.find((r) => r.date === date);
      if (!existing) return true;
      return (
        existing.type !== entry.type ||
        existing.shift_slot_id !== entry.shift_slot_id
      );
    });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">スタッフ希望入力</h1>

      {/* Staff name display */}
      {selectedStaff && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-lg font-semibold">
                  {selectedStaff.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedStaff.role} / 最大{selectedStaff.max_days_per_week}
                  日/週
                </div>
              </div>
              <a
                href="/staff"
                className="text-sm text-blue-600 hover:underline ml-auto"
              >
                スタッフ変更
              </a>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>スケジュール期間</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPeriods ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              スケジュール期間が作成されていません。管理者にお問い合わせください。
            </p>
          ) : (
            <Select
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="期間を選択してください" />
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
        </CardContent>
      </Card>

      {/* Request Calendar */}
      {selectedPeriod && selectedStaff && (
        <Card>
          <CardHeader>
            <CardTitle>
              希望入力 ({selectedPeriod.start_date} ~{" "}
              {selectedPeriod.end_date})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingRequests ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  日付をクリックして希望を入力してください。
                </p>
                <RequestCalendar
                  startDate={selectedPeriod.start_date}
                  endDate={selectedPeriod.end_date}
                  shiftSlots={shiftSlots}
                  existingRequests={existingRequests}
                  onChange={handleRequestsChange}
                />

                {/* Submit button */}
                <div className="flex items-center gap-4 pt-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || pendingRequests.size === 0}
                  >
                    {submitting ? "提出中..." : "希望を提出"}
                  </Button>
                  {hasChanges && pendingRequests.size > 0 && (
                    <span className="text-sm text-amber-600">
                      未保存の変更があります
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {pendingRequests.size}件の希望
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Published Schedule View */}
      {selectedPeriod && isPublished && selectedStaff && (
        <Card>
          <CardHeader>
            <CardTitle>確定シフト</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-muted-foreground">
                このスタッフの確定シフトはありません。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border rounded-lg">
                  <thead>
                    <tr>
                      <th className="border px-3 py-2 text-left text-sm font-semibold bg-gray-50">
                        日付
                      </th>
                      <th className="border px-3 py-2 text-left text-sm font-semibold bg-gray-50">
                        シフト
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments
                      .sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime()
                      )
                      .map((assignment) => {
                        const d = new Date(assignment.date + "T00:00:00");
                        const dow = DAY_NAMES_FULL[d.getDay()];
                        const isWeekend =
                          d.getDay() === 0 || d.getDay() === 6;

                        return (
                          <tr key={assignment.id}>
                            <td
                              className={`border px-3 py-1.5 text-sm ${
                                isWeekend ? "text-red-600" : ""
                              }`}
                            >
                              {assignment.date} ({dow})
                            </td>
                            <td className="border px-3 py-1.5 text-sm">
                              {assignment.shift_slot_id !== null ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                                  {getSlotName(assignment.shift_slot_id)}
                                </span>
                              ) : (
                                <span className="text-gray-400">休み</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const DAY_NAMES_FULL = ["日", "月", "火", "水", "木", "金", "土"];

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      }
    >
      <StaffPageContent />
    </Suspense>
  );
}
