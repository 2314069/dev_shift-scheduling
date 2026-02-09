"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ShiftSlot, StaffingRequirement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const DAY_TYPE_LABELS: Record<string, string> = {
  weekday: "平日",
  weekend: "休日",
};

export function StaffingRequirementsTable() {
  const [requirements, setRequirements] = useState<StaffingRequirement[]>([]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<StaffingRequirement | null>(null);

  // Form state
  const [formShiftSlotId, setFormShiftSlotId] = useState<string>("");
  const [formDayType, setFormDayType] = useState<string>("weekday");
  const [formMinCount, setFormMinCount] = useState(1);

  async function fetchData() {
    try {
      setLoading(true);
      const [reqData, slotData] = await Promise.all([
        apiFetch<StaffingRequirement[]>("/api/staffing-requirements"),
        apiFetch<ShiftSlot[]>("/api/shift-slots"),
      ]);
      setRequirements(reqData);
      setShiftSlots(slotData);
      setError(null);
    } catch (e) {
      setError("データの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function getSlotName(slotId: number): string {
    const slot = shiftSlots.find((s) => s.id === slotId);
    return slot ? slot.name : `不明 (ID: ${slotId})`;
  }

  function openAddDialog() {
    setEditingReq(null);
    setFormShiftSlotId(shiftSlots.length > 0 ? String(shiftSlots[0].id) : "");
    setFormDayType("weekday");
    setFormMinCount(1);
    setDialogOpen(true);
  }

  function openEditDialog(req: StaffingRequirement) {
    setEditingReq(req);
    setFormShiftSlotId(String(req.shift_slot_id));
    setFormDayType(req.day_type);
    setFormMinCount(req.min_count);
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      const body = {
        shift_slot_id: Number(formShiftSlotId),
        day_type: formDayType,
        min_count: formMinCount,
      };

      if (editingReq) {
        await apiFetch<StaffingRequirement>(
          `/api/staffing-requirements/${editingReq.id}`,
          {
            method: "PUT",
            body: JSON.stringify(body),
          }
        );
      } else {
        await apiFetch<StaffingRequirement>("/api/staffing-requirements", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setDialogOpen(false);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <Card>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button onClick={openAddDialog} disabled={shiftSlots.length === 0}>
            追加
          </Button>
        </div>

        {shiftSlots.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            先にシフト枠を登録してください。
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>シフト枠</TableHead>
              <TableHead>日種別</TableHead>
              <TableHead>最低人数</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requirements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  必要人数が設定されていません
                </TableCell>
              </TableRow>
            ) : (
              requirements.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{getSlotName(req.shift_slot_id)}</TableCell>
                  <TableCell>
                    {DAY_TYPE_LABELS[req.day_type] || req.day_type}
                  </TableCell>
                  <TableCell>{req.min_count}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(req)}
                    >
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingReq ? "必要人数編集" : "必要人数追加"}
              </DialogTitle>
              <DialogDescription>
                必要人数の情報を入力してください。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">シフト枠</label>
                <Select
                  value={formShiftSlotId}
                  onValueChange={setFormShiftSlotId}
                  disabled={editingReq !== null}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="シフト枠を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftSlots.map((slot) => (
                      <SelectItem key={slot.id} value={String(slot.id)}>
                        {slot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">日種別</label>
                <Select
                  value={formDayType}
                  onValueChange={setFormDayType}
                  disabled={editingReq !== null}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="日種別を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekday">平日</SelectItem>
                    <SelectItem value="weekend">休日</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">最低人数</label>
                <Input
                  type="number"
                  min={1}
                  value={formMinCount}
                  onChange={(e) => setFormMinCount(Number(e.target.value))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSave}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
