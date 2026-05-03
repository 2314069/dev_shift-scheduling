/**
 * 保護ルートの定義
 *
 * 未認証ユーザーを /signin にリダイレクトする。
 * Edge Runtime では Node.js stream モジュールが使えないため、
 * Nodemailer を含まない auth.config.ts の設定だけを使う Edge-safe な auth を参照する。
 */
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse, type NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// E2E テスト時のみ認証をバイパスする安全弁付きのミドルウェア。
// fail-close ホワイトリスト方式: NODE_ENV を "development" / "test" のときに限り
// バイパスを有効化する（NODE_ENV 未設定や予期しない値ではバイパスされない）。
function createMiddleware() {
  const allowedEnvs = new Set(["development", "test"]);
  const e2eBypass =
    process.env.E2E_DISABLE_AUTH === "1" &&
    allowedEnvs.has(process.env.NODE_ENV ?? "");

  if (e2eBypass) {
    // E2E バイパスモード: 認証チェックをスキップして通過させる
    return (_req: NextRequest) => NextResponse.next();
  }

  // 通常モード: Auth.js による認証チェック
  return auth((req) => {
    const isAuth = !!req.auth;
    const pathname = req.nextUrl.pathname;

    // 認証ページは未ログインでもアクセス可
    const isAuthPage =
      pathname.startsWith("/signin") ||
      pathname.startsWith("/verify-request") ||
      pathname.startsWith("/auth/error");

    if (!isAuth && !isAuthPage) {
      const signInUrl = new URL("/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  });
}

export default createMiddleware();

export const config = {
  // 静的アセット・Next.js 内部ルート・Auth.js API ルートを除外する
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
