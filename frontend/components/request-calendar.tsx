"use client";

import { useState, useEffect } from "react";
import type { ShiftSlot, StaffRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

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

/** A single request entry keyed by date */
export interface RequestEntry {
  type: "preferred" | "unavailable";
  shift_slot_id: number | null;
}

interface RequestCalendarProps {
  startDate: string;
  endDate: string;
  shiftSlots: ShiftSlot[];
  existingRequests: StaffRequest[];
  onChange: (requests: Map<string, RequestEntry>) => void;
}

export function RequestCalendar({
  startDate,
  endDate,
  shiftSlots,
  existingRequests,
  onChange,
}: RequestCalendarProps) {
  const dates = getDatesInRange(startDate, endDate);

  // Internal state: Map<date, RequestEntry>
  const [requestMap, setRequestMap] = useState<Map<string, RequestEntry>>(
    () => {
      const map = new Map<string, RequestEntry>();
      for (const req of existingRequests) {
        map.set(req.date, {
          type: req.type,
          shift_slot_id: req.shift_slot_id,
        });
      }
      return map;
    }
  );

  const [openPopoverDate, setOpenPopoverDate] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Sync with existingRequests when they change
  useEffect(() => {
    const map = new Map<string, RequestEntry>();
    for (const req of existingRequests) {
      map.set(req.date, {
        type: req.type,
        shift_slot_id: req.shift_slot_id,
      });
    }
    setRequestMap(map);
  }, [existingRequests]);

  function updateMap(newMap: Map<string, RequestEntry>) {
    setRequestMap(newMap);
    onChange(newMap);
  }

  function handleSelectOption(
    date: string,
    option: "clear" | "unavailable" | number
  ) {
    const newMap = new Map(requestMap);
    if (option === "clear") {
      newMap.delete(date);
    } else if (option === "unavailable") {
      newMap.set(date, { type: "unavailable", shift_slot_id: null });
    } else {
      newMap.set(date, { type: "preferred", shift_slot_id: option });
    }
    updateMap(newMap);
    setOpenPopoverDate(null);
  }

  function handleClearAll() {
    updateMap(new Map());
    setClearConfirmOpen(false);
  }

  function handleBulkSetWeekdays(slotId: number) {
    const newMap = new Map(requestMap);
    for (const date of dates) {
      const d = new Date(date + "T00:00:00");
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        newMap.set(date, { type: "preferred", shift_slot_id: slotId });
      }
    }
    updateMap(newMap);
  }

  function handleBulkSetWeekendsUnavailable() {
    const newMap = new Map(requestMap);
    for (const date of dates) {
      const d = new Date(date + "T00:00:00");
      const day = d.getDay();
      if (day === 0 || day === 6) {
        newMap.set(date, { type: "unavailable", shift_slot_id: null });
      }
    }
    updateMap(newMap);
  }

  function getSlotName(slotId: number): string {
    const slot = shiftSlots.find((s) => s.id === slotId);
    return slot ? slot.name : `ID:${slotId}`;
  }

  function getCellStyle(entry: RequestEntry | undefined): string {
    if (!entry) {
      return "bg-gray-50 border-gray-200 text-gray-400";
    }
    if (entry.type === "unavailable") {
      return "bg-red-100 border-red-300 text-red-800";
    }
    return "bg-blue-100 border-blue-300 text-blue-800";
  }

  function getCellLabel(entry: RequestEntry | undefined): string {
    if (!entry) {
      return "未入力";
    }
    if (entry.type === "unavailable") {
      return "不可";
    }
    if (entry.shift_slot_id !== null) {
      return `希望: ${getSlotName(entry.shift_slot_id)}`;
    }
    return "希望";
  }

  if (dates.length === 0) {
    return <p className="text-muted-foreground">期間が設定されていません。</p>;
  }

  // Group dates by week for a grid layout
  const weeks: string[][] = [];
  let currentWeek: string[] = [];

  const firstDay = new Date(dates[0] + "T00:00:00").getDay();
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push("");
  }

  for (const date of dates) {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push("");
    }
    weeks.push(currentWeek);
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions toolbar */}
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              一括設定
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {shiftSlots.map((slot) => (
              <DropdownMenuItem
                key={slot.id}
                onClick={() => handleBulkSetWeekdays(slot.id)}
              >
                全平日を「{slot.name}」に設定
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleBulkSetWeekendsUnavailable}>
              全休日を出勤不可に設定
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setClearConfirmOpen(true)}
          disabled={requestMap.size === 0}
        >
          すべてクリア
        </Button>
      </div>

      {/* Calendar grid header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-gray-600"
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid body */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="h-20" />;
          }

          const entry = requestMap.get(date);
          const cellStyle = getCellStyle(entry);
          const cellLabel = getCellLabel(entry);
          const d = new Date(date + "T00:00:00");
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

          return (
            <Popover
              key={date}
              open={openPopoverDate === date}
              onOpenChange={(open) =>
                setOpenPopoverDate(open ? date : null)
              }
            >
              <PopoverTrigger asChild>
                <button
                  className={`h-20 w-full border rounded-md p-1.5 cursor-pointer transition-colors hover:ring-2 hover:ring-blue-400 text-left ${cellStyle}`}
                >
                  <div
                    className={`text-xs font-medium ${
                      isWeekend ? "text-red-600" : ""
                    }`}
                  >
                    {formatDate(date)}
                  </div>
                  <div className="text-xs mt-1 font-medium">{cellLabel}</div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 border-b mb-1">
                  {formatDate(date)}
                </div>
                {shiftSlots.map((slot) => (
                  <button
                    key={slot.id}
                    className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                      entry?.type === "preferred" && entry?.shift_slot_id === slot.id
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : ""
                    }`}
                    onClick={() => handleSelectOption(date, slot.id)}
                  >
                    希望: {slot.name}
                  </button>
                ))}
                <button
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-red-50 hover:text-red-700 transition-colors ${
                    entry?.type === "unavailable"
                      ? "bg-red-50 text-red-700 font-medium"
                      : ""
                  }`}
                  onClick={() => handleSelectOption(date, "unavailable")}
                >
                  出勤不可
                </button>
                <div className="border-t mt-1 pt-1">
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-gray-500 transition-colors"
                    onClick={() => handleSelectOption(date, "clear")}
                  >
                    クリア
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="font-medium text-gray-600">凡例:</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800">
          希望
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800">
          不可
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-200">
          未入力
        </span>
      </div>

      {/* Clear all confirm dialog */}
      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="すべてクリア"
        description="すべての希望入力をクリアします。よろしいですか？"
        variant="destructive"
        onConfirm={handleClearAll}
      />
    </div>
  );
}
