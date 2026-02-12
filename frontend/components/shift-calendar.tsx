"use client";

import { useState, useCallback, useEffect } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { Staff, ShiftSlot, ScheduleAssignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

const SLOT_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-yellow-100 text-yellow-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
];

function getSlotColor(slotIndex: number): string {
  return SLOT_COLORS[slotIndex % SLOT_COLORS.length];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = DAY_NAMES[date.getDay()];
  return `${month}/${day}(${dow})`;
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

interface PendingEdit {
  assignmentId: number;
  newSlotId: number | null;
}

interface ShiftCalendarProps {
  periodId: number;
  startDate: string;
  endDate: string;
  staffList: Staff[];
  shiftSlots: ShiftSlot[];
  assignments: ScheduleAssignment[];
  isPublished: boolean;
  onAssignmentUpdated: () => void;
}

export function ShiftCalendar({
  periodId,
  startDate,
  endDate,
  staffList,
  shiftSlots,
  assignments,
  isPublished,
  onAssignmentUpdated,
}: ShiftCalendarProps) {
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [localAssignments, setLocalAssignments] = useState<ScheduleAssignment[]>(assignments);
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(new Map());
  const [saving, setSaving] = useState(false);

  // Sync localAssignments when assignments prop changes (after server fetch)
  useEffect(() => {
    setLocalAssignments(assignments);
    setPendingEdits(new Map());
  }, [assignments]);

  const dates = getDatesInRange(startDate, endDate);

  // Build a lookup map: `${staffId}-${date}` -> assignment
  const assignmentMap = new Map<string, ScheduleAssignment>();
  for (const a of localAssignments) {
    assignmentMap.set(`${a.staff_id}-${a.date}`, a);
  }

  // Build slot index map for colors
  const slotIndexMap = new Map<number, number>();
  shiftSlots.forEach((slot, index) => {
    slotIndexMap.set(slot.id, index);
  });

  function getSlotName(slotId: number | null): string {
    if (slotId === null) return "";
    const slot = shiftSlots.find((s) => s.id === slotId);
    return slot ? slot.name : "";
  }

  function getSlotTimeRange(slotId: number): string {
    const slot = shiftSlots.find((s) => s.id === slotId);
    return slot ? `${slot.start_time}〜${slot.end_time}` : "";
  }

  const handleCellEdit = useCallback(
    (staffId: number, date: string, assignment: ScheduleAssignment, newSlotId: string) => {
      const key = `${staffId}-${date}`;
      const parsedSlotId = newSlotId === "off" ? null : Number(newSlotId);

      // Update local state optimistically
      setLocalAssignments((prev) =>
        prev.map((a) =>
          a.id === assignment.id
            ? { ...a, shift_slot_id: parsedSlotId, is_manual_edit: true }
            : a
        )
      );

      // Track pending edit
      setPendingEdits((prev) => {
        const next = new Map(prev);
        // If reverting to original value, remove from pending
        const original = assignments.find((a) => a.id === assignment.id);
        if (original && original.shift_slot_id === parsedSlotId) {
          next.delete(key);
        } else {
          next.set(key, { assignmentId: assignment.id, newSlotId: parsedSlotId });
        }
        return next;
      });

      setOpenPopoverKey(null);
    },
    [assignments]
  );

  async function handleSaveAll() {
    if (pendingEdits.size === 0) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        Array.from(pendingEdits.values()).map((edit) =>
          apiFetch(`/api/schedules/${periodId}/assignments/${edit.assignmentId}`, {
            method: "PUT",
            body: JSON.stringify({
              shift_slot_id: edit.newSlotId,
              is_manual_edit: true,
            }),
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        toast.error(`${failed}件の更新に失敗しました`);
      } else {
        toast.success(`${pendingEdits.size}件の変更を保存しました`);
      }

      onAssignmentUpdated();
    } catch {
      toast.error("シフトの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardAll() {
    setLocalAssignments(assignments);
    setPendingEdits(new Map());
  }

  function renderCell(staff: Staff, date: string) {
    const key = `${staff.id}-${date}`;
    const assignment = assignmentMap.get(key);
    const isPending = pendingEdits.has(key);

    if (!assignment) return null;

    const slotId = assignment.shift_slot_id;
    const slotName = getSlotName(slotId);
    const isEmpty = slotId === null;

    const cellContent = isEmpty ? (
      <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 bg-gray-50">
        -
      </div>
    ) : (
      <div
        className={`h-full w-full flex items-center justify-center text-xs font-medium rounded ${getSlotColor(slotIndexMap.get(slotId) ?? 0)} ${
          assignment.is_manual_edit ? "ring-2 ring-orange-400" : ""
        }`}
        title={assignment.is_manual_edit ? `${slotName} (手動編集)` : slotName}
      >
        {slotName}
      </div>
    );

    if (isPublished) return cellContent;

    return (
      <Popover
        open={openPopoverKey === key}
        onOpenChange={(open) => setOpenPopoverKey(open ? key : null)}
      >
        <PopoverTrigger asChild>
          <button
            className={`group relative h-full w-full rounded transition-all hover:ring-2 hover:ring-blue-300 focus:outline-none ${
              isPending ? "ring-2 ring-amber-400" : ""
            }`}
          >
            {cellContent}
            <span className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="h-3 w-3 text-gray-400" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1 border-b mb-1">
            {formatDate(date)} - {staff.name}
          </div>
          <button
            className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors ${
              slotId === null ? "bg-gray-100 font-medium" : ""
            }`}
            onClick={() => handleCellEdit(staff.id, date, assignment, "off")}
          >
            休み
          </button>
          {shiftSlots.map((slot) => (
            <button
              key={slot.id}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                slotId === slot.id ? "bg-blue-50 text-blue-700 font-medium" : ""
              }`}
              onClick={() => handleCellEdit(staff.id, date, assignment, String(slot.id))}
            >
              <div>{slot.name}</div>
              <div className="text-xs text-muted-foreground">{getSlotTimeRange(slot.id)}</div>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  if (staffList.length === 0) {
    return (
      <p className="text-muted-foreground">スタッフが登録されていません。</p>
    );
  }

  if (dates.length === 0) {
    return <p className="text-muted-foreground">期間が設定されていません。</p>;
  }

  return (
    <div className="space-y-0">
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border-b border-r px-3 py-2 text-left text-sm font-semibold min-w-[120px]">
                スタッフ
              </th>
              {dates.map((date) => {
                const d = new Date(date + "T00:00:00");
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={date}
                    className={`border-b border-r px-1 py-2 text-center text-xs font-medium min-w-[70px] ${
                      isWeekend ? "bg-red-50 text-red-700" : "bg-gray-50"
                    }`}
                  >
                    {formatDate(date)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 z-10 bg-white border-b border-r px-3 py-1 text-sm font-medium whitespace-nowrap">
                  {staff.name}
                </td>
                {dates.map((date) => (
                  <td
                    key={`${staff.id}-${date}`}
                    className="border-b border-r p-0.5 h-9"
                  >
                    {renderCell(staff, date)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating save bar */}
      {pendingEdits.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-lg shadow-lg px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">
            {pendingEdits.size}件の変更
          </span>
          <Button size="sm" onClick={handleSaveAll} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiscardAll}
            disabled={saving}
          >
            取り消す
          </Button>
        </div>
      )}
    </div>
  );
}
