"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ShiftSlot } from "@/lib/types";
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
import { Card, CardContent } from "@/components/ui/card";

export function ShiftSlotTable() {
  const [slots, setSlots] = useState<ShiftSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ShiftSlot | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");

  async function fetchSlots() {
    try {
      setLoading(true);
      const data = await apiFetch<ShiftSlot[]>("/api/shift-slots");
      setSlots(data);
      setError(null);
    } catch (e) {
      setError("シフト枠の取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSlots();
  }, []);

  function openAddDialog() {
    setEditingSlot(null);
    setFormName("");
    setFormStartTime("09:00");
    setFormEndTime("17:00");
    setDialogOpen(true);
  }

  function openEditDialog(slot: ShiftSlot) {
    setEditingSlot(slot);
    setFormName(slot.name);
    setFormStartTime(slot.start_time);
    setFormEndTime(slot.end_time);
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      const body = {
        name: formName,
        start_time: formStartTime,
        end_time: formEndTime,
      };

      if (editingSlot) {
        await apiFetch<ShiftSlot>(`/api/shift-slots/${editingSlot.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch<ShiftSlot>("/api/shift-slots", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setDialogOpen(false);
      await fetchSlots();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  }

  async function handleDelete(slot: ShiftSlot) {
    if (!window.confirm(`「${slot.name}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      await apiFetch(`/api/shift-slots/${slot.id}`, { method: "DELETE" });
      await fetchSlots();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
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
          <Button onClick={openAddDialog}>追加</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>シフト名</TableHead>
              <TableHead>開始時間</TableHead>
              <TableHead>終了時間</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  シフト枠が登録されていません
                </TableCell>
              </TableRow>
            ) : (
              slots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell>{slot.name}</TableCell>
                  <TableCell>{slot.start_time}</TableCell>
                  <TableCell>{slot.end_time}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(slot)}
                    >
                      編集
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(slot)}
                    >
                      削除
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
                {editingSlot ? "シフト枠編集" : "シフト枠追加"}
              </DialogTitle>
              <DialogDescription>
                シフト枠の情報を入力してください。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">シフト名</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例: 早番"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">開始時間</label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">終了時間</label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
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
