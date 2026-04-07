"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchFairnessDashboard } from "@/lib/api";
import type {
  FairnessDashboardData,
  StaffFairnessMetrics,
} from "@/lib/types";

interface FairnessDashboardProps {
  periodId: number;
}

interface InlineBarProps {
  value: number;
  max: number;
  colorClass: string;
}

function InlineBar({ value, max, colorClass }: InlineBarProps) {
  // max が 0 の場合は幅 0 で表示
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
      <div
        className={`h-1.5 rounded-full ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface MetricCellProps {
  value: number;
  max: number;
  colorClass: string;
}

function MetricCell({ value, max, colorClass }: MetricCellProps) {
  return (
    <TableCell className="text-center">
      <span className="font-medium tabular-nums">{value}</span>
      <InlineBar value={value} max={max} colorClass={colorClass} />
    </TableCell>
  );
}

function computeMaxValues(metrics: StaffFairnessMetrics[]) {
  return {
    total: Math.max(...metrics.map((m) => m.total_shifts), 1),
    early: Math.max(...metrics.map((m) => m.early_shifts), 1),
    late: Math.max(...metrics.map((m) => m.late_shifts), 1),
    other: Math.max(...metrics.map((m) => m.other_shifts), 1),
    weekend: Math.max(...metrics.map((m) => m.weekend_shifts), 1),
  };
}

export function FairnessDashboard({ periodId }: FairnessDashboardProps) {
  const [data, setData] = useState<FairnessDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFairnessDashboard(periodId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "データの取得に失敗しました";
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [periodId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart2 className="h-5 w-5" />
          公平性分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {data && !loading && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>スタッフ名</TableHead>
                  <TableHead className="text-center">合計</TableHead>
                  <TableHead className="text-center">早番</TableHead>
                  <TableHead className="text-center">遅番</TableHead>
                  <TableHead className="text-center">その他</TableHead>
                  <TableHead className="text-center">土日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const maxValues = computeMaxValues(data.staff_metrics);
                  return data.staff_metrics.map((m) => (
                    <TableRow key={m.staff_id}>
                      <TableCell className="font-medium">
                        {m.staff_name}
                      </TableCell>
                      <MetricCell
                        value={m.total_shifts}
                        max={maxValues.total}
                        colorClass="bg-gray-400"
                      />
                      <MetricCell
                        value={m.early_shifts}
                        max={maxValues.early}
                        colorClass="bg-blue-400"
                      />
                      <MetricCell
                        value={m.late_shifts}
                        max={maxValues.late}
                        colorClass="bg-orange-400"
                      />
                      <MetricCell
                        value={m.other_shifts}
                        max={maxValues.other}
                        colorClass="bg-green-400"
                      />
                      <MetricCell
                        value={m.weekend_shifts}
                        max={maxValues.weekend}
                        colorClass="bg-purple-400"
                      />
                    </TableRow>
                  ));
                })()}

                {/* Summary row */}
                <TableRow className="border-t-2 font-medium bg-muted/40">
                  <TableCell className="font-semibold">全体平均</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {data.summary.avg_total.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {data.summary.avg_early.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {data.summary.avg_late.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    —
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {data.summary.avg_weekend.toFixed(1)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
