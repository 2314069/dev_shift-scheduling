"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { ConfirmDialog } from "@/components/confirm-dialog";

export function ShiftSlotTable() {
  const [slots, setSlots] = useState<ShiftSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ShiftSlot | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ShiftSlot | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");

  // Validation
  const nameError = formName.trim() === "" ? "シフト名は必須です" : null;
  const startTimeError = formStartTime === "" ? "開始時間は必須です" : null;
  const endTimeError = formEndTime === "" ? "終了時間は必須です" : null;
  const timeRangeError =
    formStartTime && formEndTime && formEndTime <= formStartTime
      ? "終了時間は開始時間より後にしてください"
      : null;
  const hasValidationError =
    nameError !== null ||
    startTimeError !== null ||
    endTimeError !== null ||
    timeRangeError !== null;

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
    if (hasValidationError) return;
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        start_time: formStartTime,
        end_time: formEndTime,
      };

      if (editingSlot) {
        await apiFetch<ShiftSlot>(`/api/shift-slots/${editingSlot.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("シフト枠を更新しました");
      } else {
        await apiFetch<ShiftSlot>("/api/shift-slots", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("シフト枠を追加しました");
      }

      setDialogOpen(false);
      await fetchSlots();
    } catch (e) {
      console.error(e);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/shift-slots/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success(`「${deleteTarget.name}」を削除しました`);
      setDeleteTarget(null);
      await fetchSlots();
    } catch (e) {
      console.error(e);
      toast.error("削除に失敗しました");
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

        {slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-1">
              シフト枠が登録されていません
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              早番・遅番などのシフト枠を作成してください。
            </p>
            <Button onClick={openAddDialog}>最初のシフト枠を追加</Button>
          </div>
        ) : (
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
              {slots.map((slot) => (
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
                      onClick={() => setDeleteTarget(slot)}
                    >
                      削除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

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
                {formName !== "" && nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">開始時間</label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
                {startTimeError && (
                  <p className="text-xs text-destructive">{startTimeError}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">終了時間</label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
                {endTimeError && (
                  <p className="text-xs text-destructive">{endTimeError}</p>
                )}
                {timeRangeError && (
                  <p className="text-xs text-destructive">{timeRangeError}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={hasValidationError || saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="シフト枠の削除"
          description={`「${deleteTarget?.name}」を削除してもよろしいですか？この操作は取り消せません。`}
          variant="destructive"
          onConfirm={handleDelete}
        />
      </CardContent>
    </Card>
  );
}
