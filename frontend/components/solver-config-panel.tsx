"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { SolverConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface OptimizationFeature {
  enableKey: keyof SolverConfig;
  weightKey: keyof SolverConfig;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
}

const OPTIMIZATION_FEATURES: OptimizationFeature[] = [
  {
    enableKey: "enable_preferred_shift",
    weightKey: "weight_preferred",
    label: "希望シフト反映",
    description: "スタッフの希望シフトをできるだけ反映します",
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  {
    enableKey: "enable_fairness",
    weightKey: "weight_fairness",
    label: "勤務日数の公平配分",
    description: "スタッフ間の勤務日数差を最小化します",
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  {
    enableKey: "enable_weekend_fairness",
    weightKey: "weight_weekend_fairness",
    label: "土日祝の公平配分",
    description: "土日祝の勤務を公平に割り当てます",
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  {
    enableKey: "enable_soft_staffing",
    weightKey: "weight_soft_staffing",
    label: "必要人数のソフト制約化",
    description: "必要人数をハード制約からソフト制約に変更します",
    min: 1,
    max: 20,
    step: 1,
  },
];

interface ToggleConstraint {
  key: keyof SolverConfig;
  label: string;
  description: string;
}

const TOGGLE_CONSTRAINTS: ToggleConstraint[] = [
  {
    key: "enable_shift_interval",
    label: "シフト間インターバル制約",
    description: "連続するシフト間に最低休息時間を確保します",
  },
  {
    key: "enable_role_staffing",
    label: "ロール別必要人数",
    description: "役職ごとの最低配置人数を制約に追加します",
  },
  {
    key: "enable_min_days_per_week",
    label: "最低勤務日数/週",
    description: "各スタッフの週あたり最低勤務日数を保証します",
  },
];

export function SolverConfigPanel() {
  const [config, setConfig] = useState<SolverConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<SolverConfig>("/api/solver-config");
      setConfig(data);
    } catch {
      setError("設定の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function updateConfig(updates: Partial<SolverConfig>) {
    if (!config) return;
    const previous = config;
    // Optimistic update
    setConfig({ ...config, ...updates });
    try {
      const updated = await apiFetch<SolverConfig>("/api/solver-config", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      setConfig(updated);
    } catch {
      setConfig(previous);
      toast.error("設定の更新に失敗しました");
    }
  }

  async function handleReset() {
    try {
      const data = await apiFetch<SolverConfig>("/api/solver-config/reset", {
        method: "POST",
      });
      setConfig(data);
      toast.success("設定をデフォルトにリセットしました");
    } catch {
      toast.error("リセットに失敗しました");
    }
    setResetDialogOpen(false);
  }

  if (loading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  if (error || !config) {
    return (
      <div className="space-y-2">
        <p className="text-destructive">{error || "設定が見つかりません"}</p>
        <Button variant="outline" size="sm" onClick={fetchConfig}>
          再読み込み
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 基本設定 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          基本設定
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">連勤上限日数</label>
            <Input
              type="number"
              min={1}
              max={14}
              value={config.max_consecutive_days}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 14) {
                  updateConfig({ max_consecutive_days: v });
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">ソルバー制限時間（秒）</label>
            <Input
              type="number"
              min={5}
              max={300}
              value={config.time_limit}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 5 && v <= 300) {
                  updateConfig({ time_limit: v });
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">シフト間インターバル（時間）</label>
            <Input
              type="number"
              min={0}
              max={24}
              value={config.min_shift_interval_hours}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 0 && v <= 24) {
                  updateConfig({ min_shift_interval_hours: v });
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* 最適化機能 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          最適化機能
        </h3>
        <div className="space-y-4">
          {OPTIMIZATION_FEATURES.map((feature) => {
            const enabled = config[feature.enableKey] as boolean;
            const weight = config[feature.weightKey] as number;
            return (
              <div
                key={feature.enableKey}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{feature.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {feature.description}
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({ [feature.enableKey]: checked })
                    }
                    aria-label={feature.label}
                  />
                </div>
                {enabled && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">重み</span>
                    <Slider
                      value={[weight]}
                      min={feature.min}
                      max={feature.max}
                      step={feature.step}
                      onValueChange={([v]) =>
                        setConfig({ ...config, [feature.weightKey]: v })
                      }
                      onValueCommit={([v]) =>
                        updateConfig({ [feature.weightKey]: v })
                      }
                      className="flex-1"
                      aria-label={`${feature.label}の重み`}
                    />
                    <span className="text-sm font-mono w-10 text-right">
                      {weight.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 追加制約 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          追加制約
        </h3>
        <div className="space-y-3">
          {TOGGLE_CONSTRAINTS.map((constraint) => (
            <div
              key={constraint.key}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <div className="text-sm font-medium">{constraint.label}</div>
                <div className="text-xs text-muted-foreground">
                  {constraint.description}
                </div>
              </div>
              <Switch
                checked={config[constraint.key] as boolean}
                onCheckedChange={(checked) =>
                  updateConfig({ [constraint.key]: checked })
                }
                aria-label={constraint.label}
              />
            </div>
          ))}
        </div>
      </div>

      {/* リセット */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetDialogOpen(true)}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          デフォルトにリセット
        </Button>
      </div>

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="設定をリセット"
        description="すべての最適化設定をデフォルト値に戻します。この操作は元に戻せません。"
        variant="destructive"
        onConfirm={handleReset}
      />
    </div>
  );
}
