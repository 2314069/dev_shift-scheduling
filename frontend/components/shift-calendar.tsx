"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Pencil, Paintbrush } from "lucide-react";
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

  // Paint mode state:
  // undefined = paint mode OFF, null = painting "休み", number = painting a shift slot ID
  const [paintSlotId, setPaintSlotId] = useState<number | null | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const dragStaffIdRef = useRef<number | null>(null);

  const isPaintMode = paintSlotId !== undefined;

  // Sync localAssignments when assignments prop changes (after server fetch)
  useEffect(() => {
    setLocalAssignments(assignments);
    setPendingEdits(new Map());
  }, [assignments]);

  // Keyboard shortcuts for paint mode
  useEffect(() => {
    if (isPublished) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPaintSlotId(undefined);
        return;
      }
      // Number keys: 0 = 休み toggle, 1-N = slot toggle
      if (e.key >= "0" && e.key <= "9") {
        const num = parseInt(e.key, 10);
        if (num === 0) {
          setPaintSlotId((prev) => (prev === null ? undefined : null));
        } else if (num <= shiftSlots.length) {
          const slotId = shiftSlots[num - 1].id;
          setPaintSlotId((prev) => (prev === slotId ? undefined : slotId));
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPublished, shiftSlots]);

  // Global mouseup to end drag
  useEffect(() => {
    function handleMouseUp() {
      setIsDragging(false);
      dragStaffIdRef.current = null;
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

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

  const applyEdit = useCallback(
    (staffId: number, date: string, newSlotId: number | null) => {
      const key = `${staffId}-${date}`;
      const assignment = assignmentMap.get(key);
      if (!assignment) return;
      if (assignment.shift_slot_id === newSlotId) return;

      setLocalAssignments((prev) =>
        prev.map((a) =>
          a.id === assignment.id
            ? { ...a, shift_slot_id: newSlotId, is_manual_edit: true }
            : a
        )
      );

      setPendingEdits((prev) => {
        const next = new Map(prev);
        const original = assignments.find((a) => a.id === assignment.id);
        if (original && original.shift_slot_id === newSlotId) {
          next.delete(key);
        } else {
          next.set(key, { assignmentId: assignment.id, newSlotId });
        }
        return next;
      });
    },
    [assignmentMap, assignments]
  );

  const handleCellEdit = useCallback(
    (staffId: number, date: string, assignment: ScheduleAssignment, newSlotId: string) => {
      const parsedSlotId = newSlotId === "off" ? null : Number(newSlotId);
      applyEdit(staffId, date, parsedSlotId);
      setOpenPopoverKey(null);
    },
    [applyEdit]
  );

  function handlePaintCellDown(staffId: number, date: string) {
    if (!isPaintMode) return;
    setIsDragging(true);
    dragStaffIdRef.current = staffId;
    applyEdit(staffId, date, paintSlotId);
  }

  function handlePaintCellEnter(staffId: number, date: string) {
    if (!isDragging || !isPaintMode) return;
    // Only paint within the same staff row
    if (dragStaffIdRef.current !== staffId) return;
    applyEdit(staffId, date, paintSlotId);
  }

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

    // Paint mode: click/drag to apply
    if (isPaintMode) {
      return (
        <div
          className={`h-full w-full cursor-crosshair rounded transition-all hover:ring-2 hover:ring-blue-300 ${
            isPending ? "ring-2 ring-amber-400" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            handlePaintCellDown(staff.id, date);
          }}
          onMouseEnter={() => handlePaintCellEnter(staff.id, date)}
        >
          {cellContent}
        </div>
      );
    }

    // Normal mode: Popover editing
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
    <div
      className="space-y-0"
      style={isPaintMode ? { userSelect: "none" } : undefined}
    >
      {/* Paint mode toolbar */}
      {!isPublished && (
        <div className="flex items-center gap-2 mb-3 flex-wrap" data-testid="paint-toolbar">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Paintbrush className="h-3.5 w-3.5" />
            ペイント:
          </span>
          <Button
            size="sm"
            variant={paintSlotId === null ? "default" : "outline"}
            onClick={() => setPaintSlotId(paintSlotId === null ? undefined : null)}
            className="h-7 text-xs"
          >
            <span className="mr-1 text-muted-foreground font-mono">0</span>
            休み
          </Button>
          {shiftSlots.map((slot, index) => (
            <Button
              key={slot.id}
              size="sm"
              variant={paintSlotId === slot.id ? "default" : "outline"}
              onClick={() =>
                setPaintSlotId(paintSlotId === slot.id ? undefined : slot.id)
              }
              className="h-7 text-xs"
            >
              <span className="mr-1 text-muted-foreground font-mono">{index + 1}</span>
              {slot.name}
            </Button>
          ))}
          {isPaintMode && (
            <span className="text-xs text-muted-foreground ml-2">
              (Escで解除)
            </span>
          )}
        </div>
      )}

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
