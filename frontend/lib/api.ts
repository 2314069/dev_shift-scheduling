import type {
  FairnessDashboardData,
  MeResponse,
  OrganizationMembershipResponse,
  OrganizationResponse,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * API エラークラス
 *
 * apiFetch が throw するエラー型。status コードと detail メッセージを持つ。
 * 409「既に所有」vs「slug 衝突」の判別に detail を使う（Planner §4.2 参照）。
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`API error: ${status} - ${detail}`);
    this.name = "ApiError";
  }
}

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

// ─── Phase 1-1 オンボーディング API ────────────────────────────────────────

/**
 * 店舗（組織）を新規作成する
 *
 * 成功: 201 → OrganizationResponse を返す
 * 409「You already own an organization」→ ApiError(409, ...) を throw
 * 409「slug 衝突」→ ApiError(409, ...) を throw
 * 422 → ApiError(422, ...) を throw
 * その他: ApiError を throw
 *
 * 呼び出し側で 409 detail を確認して「既所有」か「slug 衝突」を区別する（Planner §4.2 参照）。
 */
export async function createOrganization(data: {
  name: string;
}): Promise<OrganizationResponse> {
  const res = await fetch(`${API_BASE}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // JSON parse 失敗時は status のみのエラーメッセージを使う
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<OrganizationResponse>;
}

/**
 * /api/me — 認証ユーザー情報 + 所属店舗 + オンボーディング状態を取得する（クライアント用）
 */
export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me");
}

/**
 * /api/organizations/me — 自分の所属店舗一覧を取得する
 */
export async function fetchMyOrganizations(): Promise<
  OrganizationMembershipResponse[]
> {
  return apiFetch<OrganizationMembershipResponse[]>("/api/organizations/me");
}

// ─── Phase 1-8 退会・データ削除フロー ───────────────────────────────────────

/**
 * 自アカウントを完全削除する（個人情報保護法対応）
 *
 * 成功: 204 → void を返す
 * 401: セッション切れ → apiFetch が /signin にリダイレクト
 * 500: ApiError を throw
 */
export async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/me`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    const callbackUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `/signin?callbackUrl=${callbackUrl}`;
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // JSON parse 失敗時は status のみのエラーメッセージを使う
    }
    throw new ApiError(res.status, detail);
  }
}

/**
 * 指定組織を完全削除する（個人情報保護法対応）
 *
 * 成功: 204 → void を返す
 * 403: 非 owner → ApiError(403, ...) を throw
 * 404: 組織なし → ApiError(404, ...) を throw
 */
export async function deleteOrganization(orgId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/organizations/${orgId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    const callbackUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `/signin?callbackUrl=${callbackUrl}`;
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // JSON parse 失敗時は status のみのエラーメッセージを使う
    }
    throw new ApiError(res.status, detail);
  }
}
