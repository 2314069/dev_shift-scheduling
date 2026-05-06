/**
 * Auth.js v5 設定エントリポイント
 *
 * JWT セッション戦略を採用し、DB セッションテーブルを持たない設計にする。
 * バックエンドが共有 AUTH_SECRET で stateless 検証できるため FastAPI との統合が容易になる。
 *
 * Nodemailer provider は Node.js stream に依存するため Edge Runtime では使えない。
 * middleware が参照する Edge-safe 設定は auth.config.ts に分離している。
 *
 * @see docs/plans/2026-04-30-phase0-1-auth-design.md §4
 * @see auth.config.ts for Edge-safe config
 */
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { createAuthAdapter } from "@/lib/auth-adapter";
import { authConfig } from "@/auth.config";
import { buildEmailServerConfig } from "@/lib/email-server-config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: createAuthAdapter(),
  providers: [
    Nodemailer({
      server: buildEmailServerConfig(),
      from: process.env.EMAIL_FROM ?? "noreply@shift-suketto.local",
    }),
  ],
});
