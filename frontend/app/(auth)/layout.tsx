/**
 * 認証ページ専用レイアウト
 *
 * ルートレイアウトのヘッダーナビゲーションを継承させないため、
 * (auth) ルートグループに独立したレイアウトを定義する。
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  );
}
