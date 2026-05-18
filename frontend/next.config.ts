import type { NextConfig } from "next";

// 本番では Railway の backend URL を Vercel と同じオリジンに見せるためのプロキシ。
// ブラウザ → Railway を直叩きにすると、`__Secure-authjs.session-token` Cookie が
// SameSite=Lax のためクロスサイト fetch で送信されず 401 になる。
// Vercel 経由 (/api/* → Railway/api/*) なら same-origin として Cookie が送られる。
const BACKEND_PROXY_TARGET =
  process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!BACKEND_PROXY_TARGET) {
      // ローカル開発で env 未設定なら、Next.js が直接 /api/* を受けて 404 で
      // 落とす（フロント側が `${NEXT_PUBLIC_API_URL}/api/...` で叩く想定なので
      // 通常はこのパスを踏まない）。
      return [];
    }
    // `fallback` を使う理由:
    // Next.js のルーティング順は beforeFiles → 静的ファイル → afterFiles
    // → 動的ルート → fallback。`/api/auth/[...nextauth]` は **動的ルート** なので、
    // afterFiles（デフォルト）に置くと先に rewrite が走って Railway へ流れてしまう。
    // fallback に置けば動的ルートで `[...nextauth]` がキャッチした後の残りに対してだけ
    // rewrite が適用され、`/api/auth/*` は Auth.js handler に届く。
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${BACKEND_PROXY_TARGET}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
