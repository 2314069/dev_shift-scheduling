/**
 * Auth.js v5 App Router ハンドラ
 *
 * GET/POST を両方エクスポートすることで Magic Link コールバックや
 * CSRF トークン取得など Auth.js が必要とするすべてのルートを一括処理する。
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
