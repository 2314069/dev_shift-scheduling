"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { ShiftSlot, SkillRequirement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SkillRequirementsTable() {
  const [requirements, setRequirements] = useState<SkillRequirement[]>([]);
  const [slots, setSlots] = useState<ShiftSlot[]>([]);
  const [newSlotId, setNewSlotId] = useState<string>("");
  const [newDayType, setNewDayType] = useState<string>("weekday");
  const [newSkill, setNewSkill] = useState<string>("");
  const [newMinCount, setNewMinCount] = useState<string>("1");

  useEffect(() => {
    apiFetch<SkillRequirement[]>("/api/skill-requirements").then(setRequirements);
    apiFetch<ShiftSlot[]>("/api/shift-slots").then(setSlots);
  }, []);

  async function handleAdd() {
    if (!newSlotId || !newSkill.trim()) {
      toast.error("シフト枠・スキル名を入力してください");
      return;
    }
    const count = parseInt(newMinCount, 10);
    if (isNaN(count) || count < 1) {
      toast.error("最低人数は1以上を入力してください");
      return;
    }
    try {
      const created = await apiFetch<SkillRequirement>("/api/skill-requirements", {
        method: "POST",
        body: JSON.stringify({
          shift_slot_id: parseInt(newSlotId, 10),
          day_type: newDayType,
          skill: newSkill.trim(),
          min_count: count,
        }),
      });
      setRequirements((prev) => [...prev, created]);
      setNewSkill("");
      setNewMinCount("1");
      toast.success("スキル要件を追加しました");
    } catch {
      toast.error("追加に失敗しました");
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/skill-requirements/${id}`, { method: "DELETE" });
      setRequirements((prev) => prev.filter((r) => r.id !== id));
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  const slotName = (id: number) => slots.find((s) => s.id === id)?.name ?? String(id);
  const dayTypeLabel = (dt: string) => dt === "weekday" ? "平日" : "土日祝";

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>シフト枠</TableHead>
            <TableHead>平日/土日祝</TableHead>
            <TableHead>スキル</TableHead>
            <TableHead>最低人数</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requirements.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{slotName(r.shift_slot_id)}</TableCell>
              <TableCell>{dayTypeLabel(r.day_type)}</TableCell>
              <TableCell>{r.skill}</TableCell>
              <TableCell>{r.min_count}名以上</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(r.id)}
                  aria-label="削除"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {requirements.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                スキル要件がまだ登録されていません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 追加フォーム */}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">シフト枠</label>
          <Select value={newSlotId} onValueChange={setNewSlotId}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {slots.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">平日/土日祝</label>
          <Select value={newDayType} onValueChange={setNewDayType}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekday">平日</SelectItem>
              <SelectItem value="weekend">土日祝</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">スキル名</label>
          <Input
            placeholder="例: 調理師免許"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">最低人数</label>
          <Input
            type="number"
            min={1}
            value={newMinCount}
            onChange={(e) => setNewMinCount(e.target.value)}
            className="w-20"
          />
        </div>
        <Button onClick={handleAdd} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          追加
        </Button>
      </div>
    </div>
  );
}
