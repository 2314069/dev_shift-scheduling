"use client";

/**
 * SessionProvider ラッパー
 *
 * next-auth/react の SessionProvider はクライアントコンポーネントのため、
 * layout.tsx 自体を Server Component のまま維持するために切り出す。
 */
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
