/**
 * サーバーコンポーネント専用の API fetch ヘルパー
 *
 * Edge Runtime ではなく Node.js ランタイムで動作するサーバーコンポーネントから呼ぶ。
 * next/headers の cookies() を使い、FastAPI に認証 Cookie を転送する。
 * クライアントコンポーネントからは呼び出し禁止。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §5.8
 */
import { cookies } from "next/headers";
import type { MeResponse } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * GET /api/me を呼び、現在ログイン中のユーザー情報・所属組織・オンボーディング状態を返す。
 *
 * - 401（未認証）の場合は null を返す（呼び出し元が redirect("/signin") を担う）
 * - 5xx など API エラーは Error を throw する（呼び出し元で catch するか error.tsx に委ねる）
 * - Cache-Control: no-store で毎回サーバーから取得する（組織作成直後に古いキャッシュが残らないよう）
 */
export async function fetchMeServer(): Promise<MeResponse | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API_BASE}/api/me`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  return res.json() as Promise<MeResponse>;
}
