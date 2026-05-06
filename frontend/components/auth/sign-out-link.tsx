"use client";

import { signOut } from "next-auth/react";

/**
 * テキストリンク調のログアウトボタン。
 *
 * Auth.js v5 では /api/auth/signout への GET は確認画面表示のみで、
 * 実ログアウトは POST。next-auth/react の signOut() は内部で POST を行うため、
 * このコンポーネントを介してログアウトする。
 *
 * create-org-form.tsx / error.tsx と挙動を統一する目的でクライアント分離。
 */
export function SignOutLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className={
        className ??
        "text-sm text-muted-foreground hover:underline bg-transparent border-0 p-0 cursor-pointer"
      }
    >
      ログアウト
    </button>
  );
}
