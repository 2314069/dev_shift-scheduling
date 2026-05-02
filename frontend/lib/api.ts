import type { FairnessDashboardData } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    // FastAPI に認証 Cookie を送るために credentials: "include" を設定する
    credentials: "include",
    ...options,
  });

  // セッション切れ・未認証の場合はサインインページへ即時リダイレクト
  // SSR 環境では window が存在しないため、クライアントサイドのみで実行する
  if (res.status === 401 && typeof window !== "undefined") {
    const callbackUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `/signin?callbackUrl=${callbackUrl}`;
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchFairnessDashboard(
  periodId: number,
): Promise<FairnessDashboardData> {
  return apiFetch<FairnessDashboardData>(`/api/schedules/${periodId}/fairness`);
}
