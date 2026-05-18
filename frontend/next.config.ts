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
    // afterFiles（デフォルト）= Next.js のファイルシステムが先に評価される。
    // `/api/auth/[...nextauth]/route.ts` が `/api/auth/*` をキャッチするため、
    // 下のキャッチオール rewrite には引っかからず Auth.js handler が処理する。
    // その他の `/api/*` はファイルシステムで一致しないため rewrite が適用され
    // Railway backend に転送される（same-origin で Cookie が送られる）。
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
