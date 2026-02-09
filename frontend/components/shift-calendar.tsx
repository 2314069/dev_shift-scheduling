"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Staff, ShiftSlot, ScheduleAssignment } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dates = getDatesInRange(startDate, endDate);

  // Build a lookup map: `${staffId}-${date}` -> assignment
  const assignmentMap = new Map<string, ScheduleAssignment>();
  for (const a of assignments) {
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

  async function handleCellEdit(
    assignment: ScheduleAssignment,
    newSlotId: string
  ) {
    setSaving(true);
    try {
      const body: { shift_slot_id: number | null; is_manual_edit: boolean } = {
        shift_slot_id: newSlotId === "off" ? null : Number(newSlotId),
        is_manual_edit: true,
      };
      await apiFetch(
        `/api/schedules/${periodId}/assignments/${assignment.id}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );
      onAssignmentUpdated();
    } catch (e) {
      console.error(e);
      alert("シフトの更新に失敗しました");
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  }

  function renderCell(staff: Staff, date: string) {
    const key = `${staff.id}-${date}`;
    const assignment = assignmentMap.get(key);
    const isEditing = editingCell === key;

    if (isEditing && assignment && !isPublished) {
      return (
        <Select
          value={
            assignment.shift_slot_id !== null
              ? String(assignment.shift_slot_id)
              : "off"
          }
          onValueChange={(value) => handleCellEdit(assignment, value)}
          disabled={saving}
        >
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">休み</SelectItem>
            {shiftSlots.map((slot) => (
              <SelectItem key={slot.id} value={String(slot.id)}>
                {slot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (!assignment || assignment.shift_slot_id === null) {
      // Empty / off cell
      return (
        <div
          className={`h-full w-full flex items-center justify-center text-xs text-gray-400 bg-gray-50 ${
            assignment && !isPublished ? "cursor-pointer" : ""
          }`}
          onClick={() => {
            if (assignment && !isPublished) {
              setEditingCell(key);
            }
          }}
        >
          -
        </div>
      );
    }

    const slotIndex = slotIndexMap.get(assignment.shift_slot_id) ?? 0;
    const colorClass = getSlotColor(slotIndex);
    const slotName = getSlotName(assignment.shift_slot_id);

    return (
      <div
        className={`h-full w-full flex items-center justify-center text-xs font-medium rounded ${colorClass} ${
          assignment.is_manual_edit
            ? "ring-2 ring-orange-400"
            : ""
        } ${!isPublished ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (!isPublished) {
            setEditingCell(key);
          }
        }}
        title={
          assignment.is_manual_edit ? `${slotName} (手動編集)` : slotName
        }
      >
        {slotName}
      </div>
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
  );
}
