"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { SolverConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HelpTip } from "@/components/ui/help-tip";

// --- 型安全なキー制約 (#5) ---
type BooleanKeys<T> = {
  [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];
type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

// --- データ駆動定義 (#4: 基本設定も配列化) ---
interface BasicSetting {
  key: NumberKeys<SolverConfig>;
  label: string;
  min: number;
  max: number;
}

const BASIC_SETTINGS: BasicSetting[] = [
  { key: "max_consecutive_days", label: "最大連続勤務日数", min: 1, max: 14 },
  { key: "time_limit", label: "最適化の計算時間上限（秒）", min: 5, max: 300 },
  {
    key: "min_shift_interval_hours",
    label: "連続シフト間の最低休憩時間（時間）",
    min: 0,
    max: 24,
  },
];

interface OptimizationFeature {
  enableKey: BooleanKeys<SolverConfig>;
  weightKey: NumberKeys<SolverConfig>;
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
    label: "必要人数を「目標」として扱う",
    description:
      "必要人数を必須条件ではなく「できれば満たしたい目標」として扱います。解が見つからない場合に有効です",
    min: 1,
    max: 20,
    step: 1,
  },
];

interface ToggleConstraint {
  key: BooleanKeys<SolverConfig>;
  label: string;
  description: string;
}

// --- プリセット定義 ---
type PresetValues = Pick<
  SolverConfig,
  | "max_consecutive_days"
  | "enable_preferred_shift"
  | "enable_fairness"
  | "enable_weekend_fairness"
  | "enable_shift_interval"
  | "enable_role_staffing"
  | "enable_min_days_per_week"
  | "enable_soft_staffing"
  | "enable_reverse_cycle_prohibition"
  | "enable_skill_staffing"
  | "weight_preferred"
  | "weight_fairness"
  | "weight_weekend_fairness"
  | "weight_soft_staffing"
>;

interface Preset {
  id: string;
  label: string;
  description: string;
  values: PresetValues;
}

const PRESETS: Preset[] = [
  {
    id: "balanced",
    label: "バランス型",
    description: "汎用的な標準設定",
    values: {
      max_consecutive_days: 6,
      enable_preferred_shift: true,
      enable_fairness: true,
      enable_weekend_fairness: true,
      enable_shift_interval: true,
      enable_role_staffing: false,
      enable_min_days_per_week: false,
      enable_soft_staffing: false,
      enable_reverse_cycle_prohibition: false,
      enable_skill_staffing: false,
      weight_preferred: 3.0,
      weight_fairness: 2.0,
      weight_weekend_fairness: 2.0,
      weight_soft_staffing: 10.0,
    },
  },
  {
    id: "food_service",
    label: "飲食・サービス業",
    description: "逆循環禁止・公平性重視",
    values: {
      max_consecutive_days: 5,
      enable_preferred_shift: true,
      enable_fairness: true,
      enable_weekend_fairness: true,
      enable_shift_interval: true,
      enable_role_staffing: false,
      enable_min_days_per_week: false,
      enable_soft_staffing: false,
      enable_reverse_cycle_prohibition: true,
      enable_skill_staffing: false,
      weight_preferred: 2.0,
      weight_fairness: 3.0,
      weight_weekend_fairness: 3.0,
      weight_soft_staffing: 10.0,
    },
  },
  {
    id: "medical",
    label: "介護・医療",
    description: "スキル・役割配置制約を重視",
    values: {
      max_consecutive_days: 6,
      enable_preferred_shift: true,
      enable_fairness: true,
      enable_weekend_fairness: true,
      enable_shift_interval: true,
      enable_role_staffing: true,
      enable_min_days_per_week: false,
      enable_soft_staffing: false,
      enable_reverse_cycle_prohibition: false,
      enable_skill_staffing: true,
      weight_preferred: 2.0,
      weight_fairness: 2.0,
      weight_weekend_fairness: 2.0,
      weight_soft_staffing: 10.0,
    },
  },
  {
    id: "retail",
    label: "小売・店舗",
    description: "土日祝・希望反映を強化",
    values: {
      max_consecutive_days: 6,
      enable_preferred_shift: true,
      enable_fairness: true,
      enable_weekend_fairness: true,
      enable_shift_interval: true,
      enable_role_staffing: false,
      enable_min_days_per_week: false,
      enable_soft_staffing: false,
      enable_reverse_cycle_prohibition: false,
      enable_skill_staffing: false,
      weight_preferred: 4.0,
      weight_fairness: 2.0,
      weight_weekend_fairness: 4.0,
      weight_soft_staffing: 10.0,
    },
  },
  {
    id: "flexible",
    label: "柔軟型",
    description: "必要人数をソフト制約化・制限を緩和",
    values: {
      max_consecutive_days: 7,
      enable_preferred_shift: true,
      enable_fairness: true,
      enable_weekend_fairness: false,
      enable_shift_interval: false,
      enable_role_staffing: false,
      enable_min_days_per_week: false,
      enable_soft_staffing: true,
      enable_reverse_cycle_prohibition: false,
      enable_skill_staffing: false,
      weight_preferred: 5.0,
      weight_fairness: 1.0,
      weight_weekend_fairness: 2.0,
      weight_soft_staffing: 5.0,
    },
  },
];

function detectPreset(config: SolverConfig): string | null {
  for (const preset of PRESETS) {
    const keys = Object.keys(preset.values) as (keyof PresetValues)[];
    if (keys.every((k) => config[k] === preset.values[k])) {
      return preset.id;
    }
  }
  return null;
}

const TOGGLE_CONSTRAINTS: ToggleConstraint[] = [
  {
    key: "enable_shift_interval",
    label: "連続シフト間の休憩を保証する",
    description:
      "シフトとシフトの間に、上で設定した最低休憩時間を空けるよう制約します",
  },
  {
    key: "enable_role_staffing",
    label: "役割ごとの最低人数を守る",
    description:
      "「正社員」「パート」などの役割ごとに、必要最低人数を満たすようシフトを作成します",
  },
  {
    key: "enable_min_days_per_week",
    label: "スタッフの週最低勤務日数を守る",
    description:
      "各スタッフに設定した「週の最低勤務日数」を下回らないようにシフトを作成します",
  },
  {
    key: "enable_reverse_cycle_prohibition",
    label: "逆循環シフトを禁止する",
    description:
      "遅番の翌日に早番を入れることを禁止します（例: 15時始め→翌日9時始め）",
  },
  {
    key: "enable_skill_staffing",
    label: "スキル配置制約を有効にする",
    description:
      "「設定 > スキル要件」で登録した条件を満たすようにシフトを作成します",
  },
];

export function SolverConfigPanel() {
  const [config, setConfig] = useState<SolverConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<SolverConfig>("/api/solver-config");
      setConfig(data);
      setActivePreset(detectPreset(data));
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
    const next = { ...config, ...updates };
    setConfig(next);
    setActivePreset(detectPreset(next));
    try {
      const updated = await apiFetch<SolverConfig>("/api/solver-config", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      setConfig(updated);
      setActivePreset(detectPreset(updated));
    } catch {
      setConfig(previous);
      setActivePreset(detectPreset(previous));
      toast.error("設定の更新に失敗しました");
    }
  }

  async function applyPreset(preset: Preset) {
    if (!config) return;
    await updateConfig(preset.values);
    toast.success(`「${preset.label}」を適用しました`);
  }

  async function handleReset() {
    try {
      const data = await apiFetch<SolverConfig>("/api/solver-config/reset", {
        method: "POST",
      });
      setConfig(data);
      setActivePreset(detectPreset(data));
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
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            基本設定
            <HelpTip
              label="勤務日数の上限・1日の上限など、最適化が必ず守るルールの数値です。"
              srOnlyLabel="基本設定の説明"
            />
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            勤務ルールの基本的な数値を設定します。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {BASIC_SETTINGS.map((setting) => (
            <div key={setting.key} className="space-y-1.5">
              <label className="text-sm font-medium">{setting.label}</label>
              <Input
                type="number"
                min={setting.min}
                max={setting.max}
                value={config[setting.key]}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= setting.min && v <= setting.max) {
                    setConfig({ ...config, [setting.key]: v });
                  }
                }}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= setting.min && v <= setting.max) {
                    updateConfig({ [setting.key]: v });
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* プリセット */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            業種別プリセット
            <HelpTip
              label="飲食・小売・医療など業種別の推奨値を一括適用できます。あとから個別に調整できます。"
              srOnlyLabel="業種別プリセットの説明"
            />
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            業種に合った設定をワンクリックで適用できます。適用後も各設定は個別に変更可能です。
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <div className="text-sm font-medium">{preset.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
        {activePreset === null && (
          <p className="text-xs text-muted-foreground">
            現在の設定はカスタム設定です。
          </p>
        )}
      </div>

      {/* 最適化機能 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            最適化機能
            <HelpTip
              label="『なるべく』叶えたい目標。スイッチでオン/オフ、重みで優先度を調整します。"
              srOnlyLabel="最適化機能の説明"
            />
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            オンにすると、その条件を「できるだけ満たすように」シフトを最適化します。重みが大きいほど優先されます。
          </p>
        </div>
        <div className="space-y-4">
          {OPTIMIZATION_FEATURES.map((feature) => {
            const enabled = config[feature.enableKey];
            const weight = config[feature.weightKey];
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
                    <span className="text-xs text-muted-foreground w-8 inline-flex items-center gap-1">
                      重み
                      <HelpTip
                        label="大きいほどその条件を優先します。他の最適化機能とトレードオフになります。"
                        srOnlyLabel="重みの説明"
                      />
                    </span>
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
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            追加制約
            <HelpTip
              label="『絶対に守る』ルール。オンにすると守れない場合は最適化が失敗します。"
              srOnlyLabel="追加制約の説明"
            />
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            オンにすると、その条件を必ず守るようにシフトを作成します。
          </p>
        </div>
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
                checked={config[constraint.key]}
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
