"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { Staff } from "@/lib/types";
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

export function StaffTable() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formMaxDays, setFormMaxDays] = useState(5);

  // Validation
  const nameError = formName.trim() === "" ? "名前は必須です" : null;
  const maxDaysError =
    formMaxDays < 1 || formMaxDays > 7 ? "1〜7の間で入力してください" : null;
  const hasValidationError = nameError !== null || maxDaysError !== null;

  async function fetchStaff() {
    try {
      setLoading(true);
      const data = await apiFetch<Staff[]>("/api/staff");
      setStaffList(data);
      setError(null);
    } catch (e) {
      setError("スタッフの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStaff();
  }, []);

  function openAddDialog() {
    setEditingStaff(null);
    setFormName("");
    setFormRole("");
    setFormMaxDays(5);
    setDialogOpen(true);
  }

  function openEditDialog(staff: Staff) {
    setEditingStaff(staff);
    setFormName(staff.name);
    setFormRole(staff.role);
    setFormMaxDays(staff.max_days_per_week);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (hasValidationError) return;
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        role: formRole.trim(),
        max_days_per_week: formMaxDays,
      };

      if (editingStaff) {
        await apiFetch<Staff>(`/api/staff/${editingStaff.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("スタッフを更新しました");
      } else {
        await apiFetch<Staff>("/api/staff", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("スタッフを追加しました");
      }

      setDialogOpen(false);
      await fetchStaff();
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
      await apiFetch(`/api/staff/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`「${deleteTarget.name}」を削除しました`);
      setDeleteTarget(null);
      await fetchStaff();
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

        {staffList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-1">
              スタッフが登録されていません
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              シフトを作成するには、まずスタッフを追加してください。
            </p>
            <Button onClick={openAddDialog}>最初のスタッフを追加</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>役割</TableHead>
                <TableHead>最大勤務日数/週</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell>{staff.name}</TableCell>
                  <TableCell>{staff.role}</TableCell>
                  <TableCell>{staff.max_days_per_week}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(staff)}
                    >
                      編集
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(staff)}
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
                {editingStaff ? "スタッフ編集" : "スタッフ追加"}
              </DialogTitle>
              <DialogDescription>
                スタッフ情報を入力してください。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">名前</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例: 山田太郎"
                />
                {formName !== "" && nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">役割</label>
                <Input
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="例: 正社員"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">最大勤務日数/週</label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={formMaxDays}
                  onChange={(e) => setFormMaxDays(Number(e.target.value))}
                />
                {maxDaysError && (
                  <p className="text-xs text-destructive">{maxDaysError}</p>
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
          title="スタッフの削除"
          description={`「${deleteTarget?.name}」を削除してもよろしいですか？この操作は取り消せません。`}
          variant="destructive"
          onConfirm={handleDelete}
        />
      </CardContent>
    </Card>
  );
}
