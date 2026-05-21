# ガイドカード（オンボーディング）表示ルール

シフトすけっとには、初心者向けに複数のガイドカード／ヒントカードがあります。
画面ごとに「いつ」「どのカード」を出すかを以下の表にまとめます。
**新しいカードを追加するときは、既存カードと表示が重複しないよう、この表に追記してください。**

## 表示ルール一覧

| 画面               | カード                | 表示条件                                           | dismiss 方式                     | localStorage key        |
| ------------------ | --------------------- | -------------------------------------------------- | -------------------------------- | ----------------------- |
| `/settings`        | `PageIntroCard`       | 常時（未 dismiss）                                 | 永続                             | `intro:settings`        |
| `/schedule`        | `OnboardingHintCard`  | `isSetupIncomplete`（スタッフ or シフト枠が 0 件） | session のみ（リロードで再表示） | なし                    |
| `/schedule`        | `PageIntroCard`       | `!isSetupIncomplete`                               | 永続                             | `intro:schedule`        |
| `/staff` (id なし) | `PageIntroCard`       | 常時（未 dismiss）                                 | 永続                             | `intro:staff-select`    |
| `/staff` (id あり) | `StaffOnboardingHint` | 常時（未 dismiss）                                 | 永続                             | `staff-intro:{staffId}` |
| `/view`            | `PageIntroCard`       | 常時（未 dismiss）                                 | 永続                             | `intro:view`            |

## 排他制御

- **`/schedule`**: `isSetupIncomplete ? <OnboardingHintCard /> : <PageIntroCard />` で完全排他。
  - 初期設定が未完なら警告カード（amber）が出て、完了後は通常の使い方ガイド（blue）に切り替わる。
- **`/staff`**: `staffIdParam` の有無で早期 return が分岐するため、`PageIntroCard` と `StaffOnboardingHint` は同時に出ない。
  - `id` なし: スタッフ選択リスト → `PageIntroCard`
  - `id` あり: 入力カレンダー → `StaffOnboardingHint`

## カードの目的別カタログ

### `PageIntroCard`

- **目的**: ページの使い方を 3〜4 ステップで説明する青いカード
- **dismiss**: localStorage に `storageKey` で記録し、永続的に非表示
- **再表示**: 現状 UI なし（DevTools で localStorage を消すしかない）→ 将来課題

### `OnboardingHintCard`（`/schedule` 専用）

- **目的**: スタッフ・シフト枠の登録を促す amber 色のセットアップガイド
- **dismiss**: useState（セッションのみ、リロードで再表示）
- **完了判定**: `staffCount > 0 && shiftSlotCount > 0` で自動非表示

### `StaffOnboardingHint`（`/staff?id=...` 専用）

- **目的**: URL でスタッフがアクセスしてきたときの「ようこそ {name} さん」案内
- **dismiss**: localStorage に `staff-intro:{staffId}` で記録、永続

## 既知の課題（将来対応）

1. **永続 dismiss の再表示手段がない**: `PageIntroCard` を一度閉じると、利用者が「もう一度ガイドを見たい」と思っても UI 上の手段がない。ヘルプメニューから再表示できるようにする検討余地あり。
2. **`storageKey` の命名規則**: 現在は `intro:*` と `staff-intro:*` が混在。新しいカードを追加する際は `intro:{page}` 形式を推奨。
