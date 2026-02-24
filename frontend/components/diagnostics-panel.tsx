"use client";

import { AlertCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiagnosticItem } from "@/lib/types";
import { useState } from "react";

interface DiagnosticsPanelProps {
  diagnostics: DiagnosticItem[];
}

function DiagnosticRow({ item }: { item: DiagnosticItem }) {
  const [expanded, setExpanded] = useState(false);
  const isError = item.severity === "error";

  return (
    <div
      className={`rounded-lg border p-3 ${
        isError
          ? "border-red-200 bg-red-50"
          : "border-yellow-200 bg-yellow-50"
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              isError ? "text-red-800" : "text-yellow-800"
            }`}
          >
            {item.message}
          </p>
          {item.details && item.details.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className={`mt-1 flex items-center gap-1 text-xs ${
                  isError ? "text-red-600" : "text-yellow-600"
                } hover:underline`}
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
                詳細を{expanded ? "非表示" : "表示"}
              </button>
              {expanded && (
                <ul className="mt-2 space-y-1">
                  {item.details.map((detail, i) => (
                    <li
                      key={i}
                      className={`text-xs ${
                        isError ? "text-red-700" : "text-yellow-700"
                      }`}
                    >
                      {detail}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  if (diagnostics.length === 0) return null;

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-red-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          最適化の診断結果
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {errors.map((item, i) => (
          <DiagnosticRow key={`error-${i}`} item={item} />
        ))}
        {warnings.map((item, i) => (
          <DiagnosticRow key={`warning-${i}`} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
