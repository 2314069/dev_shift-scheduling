"use client";

/**
 * ナビゲーションバーのユーザーメニュー
 *
 * useSession() でセッション状態を取得し、
 * 未ログイン時はログインボタン、ログイン時はアバター + ドロップダウンを表示する。
 * layout.tsx を Server Component のまま維持するために独立した Client Component とする。
 *
 * orgName props:
 *   - undefined（状態 B: 店舗未所属）→ メールアドレスのみ表示
 *   - string（状態 C: 店舗所属あり）→ メールアドレス + 店舗名を表示
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.4
 */
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface UserNavProps {
  /** 店舗所属あり（状態 C）のとき店舗名を渡す。未所属（状態 B）は undefined */
  orgName?: string;
}

/**
 * ユーザー名またはメールアドレスからアバターのイニシャルを生成する
 *
 * 日本語の姓名（スペース区切り）は各パートの先頭文字を使い、
 * それ以外はメールのローカル部または name の先頭2文字を大文字にする。
 */
function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

export function UserNav({ orgName }: UserNavProps = {}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    // レイアウトシフトを防ぐためにプレースホルダーを表示する
    return <div className="h-8 w-8 rounded-full bg-muted shrink-0" />;
  }

  if (!session) {
    return (
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link href="/signin">ログイン</Link>
      </Button>
    );
  }

  const user = session.user;
  if (!user) {
    // セッションは存在するがユーザー情報なし（通常起きないが型安全のため）
    return null;
  }
  const initials = getInitials(user.name, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0"
          aria-label="ユーザーメニューを開く"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 space-y-0.5">
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {orgName && (
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
              {orgName}
            </p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => signOut({ redirectTo: "/signin" })}
          className="cursor-pointer"
        >
          ログアウト
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer text-destructive">
          <Link href="/account/delete">アカウント削除</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
