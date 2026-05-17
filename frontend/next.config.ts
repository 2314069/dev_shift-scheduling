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
    return {
      beforeFiles: [
        // /api/auth/* は Next.js 側の Auth.js handler が処理するので素通し
        { source: "/api/auth/:path*", destination: "/api/auth/:path*" },
        // それ以外の /api/* は Railway backend にプロキシ
        {
          source: "/api/:path*",
          destination: `${BACKEND_PROXY_TARGET}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
