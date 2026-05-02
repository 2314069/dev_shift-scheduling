/**
 * Auth.js v5 Edge-safe 設定
 *
 * middleware（Edge Runtime）はこのファイルだけを参照する。
 * nodemailer / fetch を使うプロバイダや Adapter は含めない。
 * これにより Edge Runtime が Node.js の stream モジュールを要求しないようにする。
 *
 * フル設定（providers, adapter を含む）は auth.ts で行う。
 *
 * @see https://authjs.dev/guides/edge-compatibility
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [],
  pages: {
    signIn: "/signin",
    verifyRequest: "/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth }) {
      // jwt は auth.ts 側で処理済みのため、ここでは存在チェックのみ
      return !!auth;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
