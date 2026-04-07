import type { FairnessDashboardData } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchFairnessDashboard(
  periodId: number
): Promise<FairnessDashboardData> {
  return apiFetch<FairnessDashboardData>(
    `/api/schedules/${periodId}/fairness`
  );
}
