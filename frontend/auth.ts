/**
 * Auth.js v5 設定エントリポイント
 *
 * JWT セッション戦略を採用し、DB セッションテーブルを持たない設計にする。
 * バックエンドが共有 AUTH_SECRET で stateless 検証できるため FastAPI との統合が容易になる。
 *
 * @see docs/plans/2026-04-30-phase0-1-auth-design.md §4
 */
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { createAuthAdapter } from "@/lib/auth-adapter";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: createAuthAdapter(),
  session: {
    // JWT 戦略: DB に Session テーブルを持たず stateless 検証を行う
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 日
  },
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST ?? "localhost",
        port: Number(process.env.EMAIL_SERVER_PORT ?? "1025"),
        auth: {
          // Mailpit はパスワード認証を要求しないため空文字にする
          user: "",
          pass: "",
        },
        secure: false,
      },
      from: process.env.EMAIL_FROM ?? "noreply@shift-suketto.local",
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      // 初回サインイン時のみ user が渡されるので sub / email を JWT に焼き付ける
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
});
