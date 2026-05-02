/**
 * 保護ルートの定義
 *
 * 未認証ユーザーを /signin にリダイレクトする。
 * Auth.js v5 の auth 関数をそのまま middleware としてエクスポートすることで、
 * Edge Runtime で動作しセッション検証のオーバーヘッドを最小化できる。
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
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

export const config = {
  // 静的アセット・Next.js 内部ルート・Auth.js API ルートを除外する
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
