/**
 * オンボーディングページ専用レイアウト
 *
 * ルートレイアウトのヘッダーナビゲーションを継承させないため、
 * (onboarding) ルートグループに独立したレイアウトを定義する。
 * (auth)/layout.tsx と同一の中央寄せ実装。
 */
export default function OnboardingLayout({
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
