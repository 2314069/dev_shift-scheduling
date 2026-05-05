# Phase 1-1 オンボーディング UI/UX 設計

> 作成日: 2026-05-05
> 対象: Phase 1-1 オンボーディング
> 担当: Designer
>
> 参照ドキュメント:
> - `docs/plans/2026-05-05-phase1-1-onboarding-design.md`（Planner 技術設計 — 最優先発注書）
> - `docs/plans/2026-05-05-phase1-1-onboarding-decomposition.md`（Orchestrator タスク分解）
> - `docs/plans/2026-04-30-phase0-1-auth-ui-design.md`（Phase 0-1 認証 UI 設計 — トーン基準）
> - 既存コード: `frontend/app/(auth)/layout.tsx`, `frontend/components/auth/sign-in-form.tsx`, `frontend/components/auth/user-nav.tsx`, `frontend/app/layout.tsx`, `frontend/app/schedule/page.tsx`

---

## 1. デザイン原則

### 1.1 Phase 0-1 から踏襲する原則

- **shadcn/ui 最優先**: `frontend/components/ui/` 配下に存在しないコンポーネントは追加しない。利用可能なコンポーネントは `alert`, `alert-dialog`, `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `select`, `separator`, `slider`, `sonner`, `switch`, `table`, `tooltip`。
- **シンプルで清潔なトーン**: 背景 `bg-white` / `bg-gray-50`、ボーダー `border` / `border-gray-200`。装飾的シャドウは Card のデフォルトのみ。独自アニメーション追加禁止。
- **フォントサイズ基準**: 本文 `text-sm`、補足 `text-xs text-muted-foreground`、見出し `text-xl` 以上。
- **日本語ファースト**: コピーは平易かつ丁寧。体言止め活用。カタカナ英語は最小限。
- **フォーカスリング / ホバー**: shadcn/ui デフォルトの Tailwind クラスのみ。

### 1.2 本フェーズ独自の方針

- **段階感の表現**: オンボーディング画面は「今どこにいるか」を明示し、ユーザーが迷わない導線を作る。ただし強制ウィザード（中断不可）は採用しない。
- **離脱は常に可能**: どの画面にもサインアウトまたは「あとで設定する」の逃げ道を設ける。
- **サーバー状態の正直な反映**: チェックリストの完了状態は毎回サーバーから取得した値を表示し、LocalStorage キャッシュで誤魔化さない（Planner §3.1 の方針と一致）。
- **埋め込みカードは押し付けない**: `/schedule` 上の `OnboardingHintCard` は「気づかせる」にとどめ、操作の邪魔をしない。

---

## 2. 表記ガイドライン

### 2.1 「組織 / 店舗 / ワークスペース」統一決定

**採用: 「店舗」**

理由:
- 本プロダクト「シフトすけっと」の対象ユーザーは「小規模店舗の店長・オーナー」（Phase 0-1 UI 設計 §7.1）。「店舗名を入力してください」は目的が直感的に伝わる。
- 「組織」は企業文脈・SaaS 管理文脈のイメージが強く、小売・飲食業の店長には距離感がある。
- 「ワークスペース」は IT ツール利用者向けの表現であり、IT リテラシー「中程度」の対象に適さない。
- 内部コード・API・DB テーブル名は引き続き `organization` / `organization_id` を使う（Planner 設計書の命名のまま）。UI 文言のみ「店舗」で統一する。

### 2.2 用語対応表

| API / コード上の名称 | UI 表示文言 |
|---------------------|------------|
| `organization` / `Organization` | 店舗 |
| `organization.name` | 店舗名 |
| `OrganizationMember` (内部のみ) | — (ユーザーに見せない) |
| `role: owner` (内部のみ) | — (ユーザーに見せない) |
| `onboarding.is_complete` | 初期設定完了 |
| `staff_count` | スタッフ数 |
| `shift_slot_count` | シフト枠数 |

### 2.3 サービス名表記

- 正式表記: **シフトすけっと**（既存 `sign-in-form.tsx` に準拠）
- ロゴ / ヘッダー文字列は現行 `app/layout.tsx` の「シフトスケジューラー」を本フェーズで「シフトすけっと」に統一する（Worker C 担当、`app/layout.tsx` 変更時に合わせて修正）。

---

## 3. 画面遷移フロー

```
[未認証]
    │ middleware リダイレクト
    ▼
/signin ─────────────────────────────── (Phase 0-1 既存)
    │ Magic Link 認証完了
    ▼
/ (app/page.tsx サーバーコンポーネント)
    │
    ├─ organizations.length === 0 ──► /onboarding (組織作成フォーム)
    │                                     │
    │                                     │ 201 作成成功 / 409「既所有」
    │                                     ▼
    │                              /onboarding/getting-started
    │                                     │
    │                                     ├─「あとで設定する」──────────┐
    │                                     │ 「シフト表へ」               │
    │                                     ▼                            │
    └─ organizations.length > 0 ──► /schedule ◄────────────────────────┘
                                         │
                                    OnboardingHintCard
                                    (is_complete=false のとき表示)
```

---

## 4. 画面別設計

### 4.1 `/onboarding` — 店舗作成画面

#### 役割

新規ユーザーが初めて「自分の店舗」を登録する画面。`(onboarding)` ルートグループ内に配置し、ヘッダーナビを表示しない。

#### ワイヤーフレーム

```
┌─────────────────────────────────────────────┐
│  [ヘッダーなし: (onboarding) レイアウトによる]  │
│                                             │
│            シフトすけっと                    │
│    スタッフのシフトを、かんたんに作成できます。  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  お店を登録しましょう                 │    │
│  │  店舗名を入力すると、シフト管理を      │    │
│  │  始められます。                       │    │
│  │                                     │    │
│  │  [サーバーエラー時の Alert がここに]   │    │
│  │                                     │    │
│  │  店舗名                             │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │ 例: 渋谷カフェ 本店          │    │    │
│  │  └─────────────────────────────┘    │    │
│  │  ※ あとから変更できます              │    │
│  │                                     │    │
│  │  [  お店を登録して始める  ]          │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│         ログアウト（テキストリンク）           │
└─────────────────────────────────────────────┘
```

#### レイアウト仕様

- ページ全体: `min-h-screen flex flex-col items-center justify-center bg-gray-50`（`(auth)/layout.tsx` と同一クラス）
- ロゴ / キャッチコピー領域: `text-center mb-8`
  - ロゴ: `text-2xl font-bold`（`sign-in-form.tsx` の `text-2xl font-bold` と同一）
  - サブキャッチ: `text-sm text-muted-foreground mt-2`
- Card: `w-full max-w-sm mx-4`（`sign-in-form.tsx` の `w-full max-w-sm mx-4` と同一幅）
- ログアウトリンク: Card 下に `mt-4 text-center`、`text-sm text-muted-foreground`、テキストリンク

#### shadcn/ui コンポーネント選定

| コンポーネント | Props / クラス | 用途 |
|--------------|---------------|------|
| `Card` | — | フォームコンテナ |
| `CardHeader` | — | — |
| `CardTitle` | `text-xl` | 「お店を登録しましょう」 |
| `CardDescription` | — | サブタイトル文言 |
| `CardContent` | — | フォーム本体 |
| `Label` | `htmlFor="org-name"` | 「店舗名」ラベル |
| `Input` | `id="org-name"` `type="text"` `placeholder="例: 渋谷カフェ 本店"` `maxLength={100}` `autoFocus` `disabled={isPending}` `aria-describedby` `aria-invalid` | 店舗名入力 |
| `Button` | `type="submit"` `className="w-full"` `disabled={isPending}` `aria-busy={isPending}` | 送信ボタン |
| `Alert` variant=`"destructive"` | `className="mb-4"` | サーバーエラー表示 |
| `AlertDescription` | — | エラー本文 |
| `Loader2` (lucide-react) | `className="mr-2 h-4 w-4 animate-spin"` | ローディングアイコン |

#### 状態別スクリーン仕様

| 状態 | 挙動 |
|------|------|
| 初期表示 | `Input` に `autoFocus`。Alert 非表示。ボタン有効 |
| 入力中 | リアルタイムバリデーションなし（送信後検証） |
| 送信中 (`isPending=true`) | ボタン `disabled` + `Loader2` スピナー表示「登録中...」。Input `disabled` |
| バリデーションエラー (空文字 / 100文字超) | Input 下に `<p id="org-name-error" className="text-sm text-destructive">` でインラインエラー |
| 成功 (201) | `router.push("/onboarding/getting-started")` |
| 409「既所有」| `router.push("/onboarding/getting-started")` (既存店舗あり = フロー再進入) |
| 409「slug衝突」| Alert (destructive): 「もう一度お試しください」|
| 422 | Alert (destructive): 「入力内容を確認してください」。インラインエラーも併用 |
| ネットワークエラー / 5xx | Alert (destructive): 「通信エラーが発生しました。しばらくしてから再試行してください」|

#### インラインエラーメッセージ

| 条件 | メッセージ |
|------|-----------|
| 空文字（送信時） | 「店舗名を入力してください」 |
| 100文字超 | 「店舗名は100文字以内で入力してください」 |

#### キーストローク / タブオーダー

1. `Input#org-name`（autoFocus）
2. `Button[type=submit]`
3. `a[ログアウト]`（Cardの外）

`Enter`（Input フォーカス中）でフォーム送信（`<form>` 暗黙 submit）。

#### アクセシビリティ

```tsx
<Input
  id="org-name"
  aria-describedby={nameError ? "org-name-error" : "org-name-hint"}
  aria-invalid={!!nameError}
  aria-required="true"
/>
{nameError && (
  <p id="org-name-error" className="text-sm text-destructive" role="alert">
    {nameError}
  </p>
)}
{!nameError && (
  <p id="org-name-hint" className="text-xs text-muted-foreground">
    あとから変更できます
  </p>
)}
```

- `Button` に `aria-busy={isPending}`
- ページ `<title>`: 「店舗登録 | シフトすけっと」

---

### 4.2 `/onboarding/getting-started` — 初期データガイド画面

#### 役割

店舗作成完了直後に表示する「次にやること」のチェックリスト。サーバーコンポーネントで `fetchMeServer()` を呼び、データ投入状況をリアルタイムに反映する。

#### ワイヤーフレーム

```
┌─────────────────────────────────────────────┐
│  [ヘッダーなし: (onboarding) レイアウト]       │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  はじめましょう！                     │    │
│  │  4つのステップでシフト作成が始められます│    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ [✓] 1. スタッフを登録する      │  │    │
│  │  │     スタッフを登録しています    │  │    │
│  │  │          [設定画面へ →]       │  │    │
│  │  └───────────────────────────────┘  │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ [ ] 2. シフト枠を登録する      │  │    │
│  │  │     早番・遅番などを登録します  │  │    │
│  │  │          [設定画面へ →]       │  │    │
│  │  └───────────────────────────────┘  │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ [ ] 3. 必要人数を設定する      │  │    │
│  │  │     各シフトの必要人数を設定   │  │    │
│  │  │     します (任意)             │  │    │
│  │  │          [設定画面へ →]       │  │    │
│  │  └───────────────────────────────┘  │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ [ ] 4. 最初のシフトを作成する  │  │    │
│  │  │     最適化を実行してシフトを   │  │    │
│  │  │     自動生成します            │  │    │
│  │  │          [シフト表へ →]       │  │    │
│  │  └───────────────────────────────┘  │    │
│  │                                     │    │
│  │  [  シフト表へ（あとで設定する）  ]  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│         ログアウト（テキストリンク）           │
└─────────────────────────────────────────────┘
```

is_complete === true のとき（全ステップ完了）:

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────┐    │
│  │  はじめましょう！                     │    │
│  │  4つのステップでシフト作成が始められます│    │
│  │                                     │    │
│  │  [✓] 1. スタッフを登録する           │    │
│  │  [✓] 2. シフト枠を登録する           │    │
│  │  [✓] 3. 必要人数を設定する           │    │
│  │  [✓] 4. 最初のシフトを作成する       │    │
│  │                                     │    │
│  │  準備が整いました！                   │    │
│  │                                     │    │
│  │  [  シフト表を開く  ]（primary）     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

#### レイアウト仕様

- ページ全体: `min-h-screen flex flex-col items-center justify-center bg-gray-50`
- Card: `w-full max-w-md mx-4`（`max-w-sm` より 1 段階広め。チェックリスト 4 行が窮屈にならないよう）
- ログアウトリンク: Card 下 `mt-4 text-center text-sm text-muted-foreground`

#### チェックリスト視覚表現の選定

**採用: Card 並び（縦スタック）**

- Stepper（上部横並びのステップインジケーター）: モバイルで幅不足。4 ステップが潰れる。
- Accordion: 折り畳みが不要（各ステップは常時見えていてほしい）。
- Card 並び（縦スタック）: 完了 / 未完了の違いが視認しやすく、各ステップに「進むボタン」を自然に配置できる。

ステップ Card のスタイル:

```
未完了ステップ:
  className="border border-border rounded-lg p-4 space-y-2"
  番号バッジ: <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center">{n}</span>
  ボタン: variant="outline" size="sm"

完了済みステップ:
  className="border border-border rounded-lg p-4 space-y-2 bg-gray-50 opacity-75"
  番号バッジ: <span className="text-xs font-bold bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center">✓</span>
  ボタン: 表示するが variant="ghost" size="sm"（「再設定する →」）
```

#### ステップ定義

| # | タイトル | 説明 | リンク先 | 完了条件 |
|---|---------|------|---------|---------|
| 1 | スタッフを登録する | シフトに入るスタッフを追加します | `/settings` | `staff_count > 0` |
| 2 | シフト枠を登録する | 早番・遅番などの時間帯を登録します | `/settings` | `shift_slot_count > 0` |
| 3 | 必要人数を設定する | 各シフト枠の最低必要人数を設定します（任意） | `/settings` | 常に「未完了」表示（Phase 1-1 では count なし） |
| 4 | 最初のシフトを作成する | 最適化を実行してシフトを自動生成します | `/schedule` | 常に「未完了」表示 |

ステップ 3・4 について:
- Planner §5.6 に「Phase 1-1 ではこのステップのチェックロジックは省略可」と明記。
- ステップ 3 は完了マークをつけず「任意」バッジ (`<Badge variant="secondary">任意</Badge>`) を表示する。
- ステップ 4 はリンクボタン「シフト表へ →」のみ表示し、チェックしない。

#### 「あとで設定する」ボタンの強度

**採用: `variant="ghost"` の Button**

理由: テキストのみリンクは見落としリスクがある。`outline` は「設定画面へ」ボタンと同じ強さになりユーザーが迷う。`ghost` は「ここに離脱口があること」を示しつつ、主 CTA（「シフト表を開く」）より優先度が下であることを明確にできる。

```tsx
<Button variant="ghost" asChild className="mt-2 w-full text-muted-foreground">
  <Link href="/schedule">あとで設定する</Link>
</Button>
```

#### shadcn/ui コンポーネント選定

| コンポーネント | 用途 |
|--------------|------|
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | 全体コンテナ |
| `Badge` variant=`"secondary"` | ステップ 3 の「任意」バッジ |
| `Button` variant=`"outline"` size=`"sm"` asChild | 「設定画面へ →」ボタン |
| `Button` variant=`"ghost"` asChild | 「あとで設定する」 |
| `Button` variant=`"default"` asChild | is_complete 時「シフト表を開く」CTA |
| `Separator` | ステップリストと最下部 CTA の区切り |
| `Link` (next/link) | 各ボタンの href |

#### 状態別スクリーン

| 状態 | 挙動 |
|------|------|
| 初期表示（データ未投入） | 全ステップ「未完了」。ステップ 1・2 のボタン `variant="outline"` |
| スタッフ 1 件以上 | ステップ 1 完了マーク・`bg-gray-50 opacity-75` |
| シフト枠 1 件以上 | ステップ 2 完了マーク・`bg-gray-50 opacity-75` |
| `is_complete === true` | 完了メッセージ「準備が整いました！」表示。主 CTA「シフト表を開く」に変化（`variant="default"`） |
| 404 / fetchMeServer 失敗 | `error.tsx` が表示（後述 §4.5 参照） |

#### キーストローク / タブオーダー（未完了状態での例）

1. ステップ 1「設定画面へ」ボタン
2. ステップ 2「設定画面へ」ボタン
3. ステップ 3「設定画面へ」ボタン
4. ステップ 4「シフト表へ」ボタン
5. 「あとで設定する」ボタン
6. ログアウトリンク

#### アクセシビリティ

- ステップリストは `<ol>` で実装（順序付きリストの意味論）
- 各ステップ内 `<li>` に `aria-label="ステップ 1: スタッフを登録する（完了）"` または `"（未完了）"` を付与
- 完了アイコン (✓) は `aria-hidden="true"` でスクリーンリーダーから隠し、`aria-label` で意味を伝える

---

### 4.3 `/schedule` 上の `OnboardingHintCard` — 埋め込みガイドカード

#### 役割

`/schedule` ページ最上部に配置し、`onboarding.is_complete === false` のときのみ表示する。データが揃ったら自動的に消える（dismiss 操作不要 = Planner §3.1 に従いサーバー状態で制御）。

#### ワイヤーフレーム

```
┌──────────────────────────────────────────────────────────────────────┐
│ シフト表                                                               │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ はじめに設定が必要です                            [×]（閉じる）  │ │
│ │ シフト表を作成する前に、スタッフとシフト枠の登録が必要です。       │ │
│ │                                                                  │ │
│ │  [✓] スタッフを登録する   [ ] シフト枠を登録する                 │ │
│ │                                                                  │ │
│ │  [初期設定ガイドを見る →]（outline ボタン）                      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ （以下、既存の SchedulePage 内容）                                     │
└──────────────────────────────────────────────────────────────────────┘
```

#### スタイル仕様

```
className="rounded-lg border border-amber-200 bg-amber-50 p-4"
```

既存 `schedule/page.tsx` の `isSetupIncomplete` バナーと配色を揃える（amber 系）。ただし既存バナーはクライアントで計算しているため、将来的に `OnboardingHintCard`（サーバーから渡された props ベース）への置き換えを行う（Worker B 担当）。

#### 閉じるボタン（dismiss）

- Planner §5.6 に「dismiss は LocalStorage or サーバーフラグ判断」とある。本フェーズでは `is_complete` フラグのみで制御（スキーマ変更なし方針）。
- よって **dismiss ボタン（×）は配置するが、動作は `is_complete === true` になるまで再表示する**（LocalStorage ベースの消去は行わない）。dismiss ボタンは「今のセッションのみ非表示にする React state トグル」として実装する。
- 具体的には: `OnboardingHintCard` を `"use client"` コンポーネントとし、`dismissed` state を持つ。`dismissed === true` なら `null` を返す。ページ遷移で状態はリセットされる（意図した挙動）。

#### shadcn/ui コンポーネント選定

| コンポーネント | 用途 |
|--------------|------|
| `Button` variant=`"ghost"` size=`"sm"` | ×（dismiss）ボタン |
| `Button` variant=`"outline"` size=`"sm"` asChild | 「初期設定ガイドを見る →」 |
| `Badge` variant=`"secondary"` | ステップの完了 / 未完了を示すインライン表示（省略表示版） |

#### Props インターフェース

```typescript
interface OnboardingHintCardProps {
  staffCount: number;
  shiftSlotCount: number;
}
```

値は Server Component (`/schedule/page.tsx`) から props として渡す。`isComplete` はコンポーネント内で `staffCount > 0 && shiftSlotCount > 0` で計算する。

#### 表示ロジック

```
isComplete（staffCount > 0 && shiftSlotCount > 0）=== true のとき → レンダリングしない（親で判定）
isComplete === false かつ dismissed === false → 表示
isComplete === false かつ dismissed === true → null を返す
```

---

### 4.4 ナビゲーション 3 状態の設計

#### 状態定義と表示要件

| 状態 | 条件 | ヘッダーナビ（設定/希望入力/シフト確認/シフト表） | UserNav |
|------|------|------------------------------------------------|---------|
| A. 未ログイン | `session === null` | 非表示（`(auth)` / `(onboarding)` グループ既定） | 「ログイン」ボタン（Phase 0-1 既存） |
| B. ログイン済み・店舗未所属 | `session !== null && me.organizations.length === 0` | **非表示**（ナビリンク 4 件を削除） | アバター + ログアウトのみ（店舗情報なし） |
| C. ログイン済み・店舗所属あり | `session !== null && me.organizations.length > 0` | 全表示（現行と同じ） | アバター + 店舗名 + ログアウト |

#### ヘッダーバー構造（状態 B）

```
┌───────────────────────────────────────────────────────┐
│  シフトすけっと          [アバター（イニシャル）▼]      │
└───────────────────────────────────────────────────────┘

UserNav ドロップダウン（状態 B）:
  ┌──────────────────┐
  │ example@example  │  ← メールアドレス（グレー小文字）
  │ ──────────────── │
  │ ログアウト        │
  └──────────────────┘
```

ナビリンクは DOM から除去（`hidden` ではなく条件レンダリングで非表示）。

#### ヘッダーバー構造（状態 C）

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  シフトすけっと   設定  希望入力  シフト確認  シフト表  [アバター（イニシャル）▼] │
└────────────────────────────────────────────────────────────────────────────────┘

UserNav ドロップダウン（状態 C）:
  ┌──────────────────┐
  │ example@example  │
  │ 渋谷カフェ 本店   │  ← 店舗名（text-xs、最大 20 文字で truncate）
  │ ──────────────── │
  │ ログアウト        │
  └──────────────────┘
```

#### `UserNav` の `orgName` Props 追加仕様

```typescript
// 変更後の UserNav Props
interface UserNavProps {
  orgName?: string;  // 状態 B では undefined、状態 C では店舗名
}
```

- `orgName` がある場合: DropdownMenuContent の email 下に `<p className="text-xs text-muted-foreground truncate max-w-[160px]">{orgName}</p>` を追加
- `orgName` がない場合: email のみ表示（現行と同じ）
- `Separator` は email と orgName をまとめた上のブロックとログアウト項目の間に置く（現行の位置を維持）

#### `app/layout.tsx` の改修方針

- **サーバーコンポーネントに変換する**: `fetchMeServer()` を呼ぶため `"use client"` を削除。`SessionProvider` ・ `Toaster` ・ `TooltipProvider` 等のクライアントコンポーネントは子コンポーネントとして配置する（サーバーコンポーネントは子にクライアントコンポーネントを持てる）。
- `hasOrg` 判定: `const hasOrg = (me?.organizations.length ?? 0) > 0`
- ナビリンク 4 件を `{hasOrg && <nav>...</nav>}` で囲む
- `<UserNav orgName={me?.current_organization?.name} />` と props を渡す

**注意**: `(auth)` / `(onboarding)` グループはネスト layouts により独自の中央寄せレイアウトを持つ。ルートレイアウトのヘッダー DOM はこれらグループでも存在するが、`fetchMeServer()` が `null` を返す（未認証 or セッションなし）場合は `hasOrg = false` となりナビリンクは非表示になる。よってルートレイアウトの改修で状態 A / B に対応できる。

---

### 4.5 `(onboarding)/layout.tsx` — オンボーディング専用レイアウト

#### 仕様

`(auth)/layout.tsx` と完全に同一の実装でよい。

```tsx
// frontend/app/(onboarding)/layout.tsx
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
```

ルートレイアウトのヘッダーは技術的には継承されるが（Next.js の Layout 合成の仕様）、`(onboarding)` グループは独立 layout で `min-h-screen` を再定義するため、ヘッダーが `(onboarding)/layout.tsx` に影響しない形にする必要がある。

解決策: `(onboarding)/layout.tsx` が `min-h-screen` を持つことで、ルートレイアウトのヘッダーと重複しないよう Worker C が `app/layout.tsx` のヘッダー部分を `(onboarding)` グループで除外するよう実装する。具体的には、`app/layout.tsx` で `fetchMeServer()` が `null`（未認証）または `organizations.length === 0` のときにヘッダー DOM そのものを `null` にする、または `(onboarding)` グループ判定を `usePathname` 的に行う。

**推奨実装（Worker C 向け）**: ルートレイアウトのヘッダー全体を `{session && <header>...</header>}` で囲む。未認証（`session === null`）はヘッダーなし。認証済みなら常にヘッダーを表示（`(onboarding)` グループでも細いヘッダーが出るが、ナビリンクは `hasOrg === false` で非表示になる）。この方式が最もシンプル。

---

### 4.6 `app/page.tsx` — ルートランディング（状態分岐）

サーバーコンポーネントとして実装。表示 UI なし（リダイレクトのみ）。

```
状態 A: session === null         → redirect("/signin")
状態 B: organizations.length === 0  → redirect("/onboarding")
状態 C: organizations.length > 0   → redirect("/schedule")
```

ローディング状態の表現は発生しない（サーバーサイドリダイレクトのため、ブラウザにはリダイレクト先が返る）。

---

### 4.7 `error.tsx` の必要性について

`(onboarding)` グループに `error.tsx` を配置する。

理由: `/onboarding/getting-started` はサーバーコンポーネントで `fetchMeServer()` を呼ぶ。バックエンドダウン時に `throw new Error("API error: 500")` が発生するため、Next.js の Error Boundary として機能する `error.tsx` が必要。

設計:

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────┐    │
│  │  エラーが発生しました                │    │
│  │  ページの読み込みに失敗しました。     │    │
│  │  しばらく待ってから再試行してください。│    │
│  │                                     │    │
│  │  [  再試行  ]   [ログアウト]         │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

- `error.tsx` は必ず `"use client"` を付ける（Next.js 要件）
- 「再試行」ボタン: `reset()` 関数を呼ぶ
- 「ログアウト」リンク: `signOut()` または `/signin` への `<a>` タグ

---

## 5. コンポーネント設計

### 5.1 新規作成ファイル一覧

| ファイルパス | 種別 | "use client" | 概要 |
|------------|------|--------------|------|
| `frontend/app/(onboarding)/layout.tsx` | Layout | なし（Server） | 中央寄せ専用レイアウト |
| `frontend/app/(onboarding)/onboarding/page.tsx` | Page | なし（Server、子に Client フォームを含む） | 店舗作成ページ |
| `frontend/app/(onboarding)/onboarding/getting-started/page.tsx` | Page | なし（Server） | 初期データチェックリストページ |
| `frontend/app/(onboarding)/error.tsx` | Error Boundary | あり（必須） | エラー表示 |
| `frontend/components/onboarding/create-org-form.tsx` | Component | あり | 店舗作成フォーム本体 |
| `frontend/components/onboarding/getting-started-checklist.tsx` | Component | なし（Server） | チェックリスト表示 |
| `frontend/components/onboarding/onboarding-hint-card.tsx` | Component | あり（dismiss state） | /schedule 上の埋め込みカード |

### 5.2 Props インターフェース定義

#### `CreateOrgForm`

```typescript
// frontend/components/onboarding/create-org-form.tsx
interface CreateOrgFormProps {
  // フォーム送信成功時のコールバック。
  // 引数: 作成された OrganizationResponse（または既所有の 409 ケース用に void も可）。
  // ページ側で router.push("/onboarding/getting-started") を呼ぶ。
  onSuccess: () => void;
}
```

`"use client"` コンポーネント。`createOrganization({ name })` を `lib/api.ts` 経由で呼ぶ。

#### `GettingStartedChecklist`

```typescript
// frontend/components/onboarding/getting-started-checklist.tsx
interface GettingStartedChecklistProps {
  staffCount: number;        // me.onboarding.staff_count
  shiftSlotCount: number;    // me.onboarding.shift_slot_count
  isComplete: boolean;       // me.onboarding.is_complete
}
```

Server Component。受け取った counts を基にステップの完了状態を描画する。

#### `OnboardingHintCard`

```typescript
// frontend/components/onboarding/onboarding-hint-card.tsx
interface OnboardingHintCardProps {
  staffCount: number;
  shiftSlotCount: number;
}
```

`"use client"` コンポーネント（dismiss state 管理のため）。

### 5.3 既存ファイルへの変更一覧

| ファイルパス | 変更内容 | Worker |
|------------|---------|--------|
| `frontend/app/layout.tsx` | Server Component 化 + `fetchMeServer()` 呼び出し + `hasOrg` 判定 + `<nav>` 条件レンダリング + `<UserNav orgName={...} />` props 追加 | C |
| `frontend/app/page.tsx` | Server Component 化 + `/api/me` で 3 状態分岐 | C |
| `frontend/components/auth/user-nav.tsx` | `orgName?: string` props 追加。DropdownMenu に店舗名表示エリア追加 | C |
| `frontend/lib/api.ts` | `createOrganization` / `fetchMe` / `fetchMyOrganizations` 追加（Planner §5.7 通り） | B |
| `frontend/lib/types.ts` | Planner §5.9 の型追加（再掲しない） | B または C |
| `frontend/lib/api-server.ts` (新規) | `fetchMeServer()` Server 専用ヘルパー（Planner §5.8 通り） | C |
| `frontend/app/schedule/page.tsx` | `OnboardingHintCard` を最上部に追加（既存 `isSetupIncomplete` バナーを置き換え） | B |

---

## 6. ナビゲーション / レイアウト改修の影響範囲

### 6.1 変更の最小化方針

- `middleware.ts` は変更なし（Planner §5.2 決定）。
- `(auth)/layout.tsx` は変更なし。
- `(auth)` グループの signin / verify-request / auth/error 画面は変更なし。
- 既存の `UserNav` の基本構造（useSession・signOut・getInitials）は維持し、`orgName` props を追加するだけ。

### 6.2 `app/layout.tsx` Server Component 化の注意点

現行の `app/layout.tsx` は暗黙的に Server Component（`"use client"` なし）。ただし `<SessionProvider>` という Client Component を子に持つことで成立している。`fetchMeServer()` を追加するだけなので `"use client"` は引き続き不要。

`fetchMeServer()` が `null` を返すケース（未認証）でもレイアウトはクラッシュしない: `me?.organizations.length ?? 0` のように optional chaining で安全に参照する。

---

## 7. インタラクション仕様

### 7.1 店舗作成フォーム（`/onboarding`）

| タイミング | 挙動 |
|-----------|------|
| フォーム送信 | `startTransition` で `isPending = true`。ボタン `disabled` + Spinner 表示 |
| 201 成功 | `router.push("/onboarding/getting-started")` でクライアントサイドナビゲーション |
| 409「既所有」| `router.push("/onboarding/getting-started")` |
| 409「slug衝突」| `isPending = false`。Alert (destructive) 表示。フォームは維持（入力値を消さない） |
| 422 | `isPending = false`。Alert (destructive) + フィールドエラー表示 |
| ネットワーク/5xx | `isPending = false`。Alert (destructive) 表示 |
| ページ遷移完了 | （新しいページでの表示） |

トースト通知（Sonner）は `/onboarding` 画面では使わない。Alert（Card 内インライン）のみ使用。理由: オンボーディングはヘッダーナビなし = Toaster の位置関係が不安定になる可能性があるため、より視認しやすいインライン Alert を選択。

### 7.2 初期データガイド（`/onboarding/getting-started`）

| タイミング | 挙動 |
|-----------|------|
| ページ表示 | サーバーコンポーネントのため、読み込み中状態なし（Suspense は不要） |
| 「設定画面へ →」クリック | `<Link href="/settings">` でフルページナビゲーション |
| 「シフト表へ →」クリック | `<Link href="/schedule">` でフルページナビゲーション |
| 「あとで設定する」クリック | `<Link href="/schedule">` でフルページナビゲーション |
| 設定を終えて戻る | ブラウザバック → サーバーコンポーネント再評価 → 最新の `me.onboarding` が取得される |

ローディング状態について: `/getting-started` はサーバーコンポーネントのため Skeleton / Spinner は不要。ページ間の遷移は Next.js の標準ルーターによるページローディング表示に委ねる。

### 7.3 `OnboardingHintCard`（`/schedule` 上）

| タイミング | 挙動 |
|-----------|------|
| ページロード時 | Server Component が `staffCount` / `shiftSlotCount` を props として渡す。`isComplete` なら親で `null` を渡さない |
| ×（dismiss）クリック | `dismissed = true` に state 変更。即座に非表示。ページリロードで再表示 |
| 「初期設定ガイドを見る →」クリック | `<Link href="/onboarding/getting-started">` |

### 7.4 リダイレクトのフラッシュ防止

`app/page.tsx` のサーバーコンポーネントリダイレクトにより、ブラウザはリダイレクト先のページを直接受け取る（クライアントサイドの遷移ではないため、「一瞬ホーム画面が見える」フラッシュは起きない）。

---

## 8. コピーライティング集

### 8.1 `/onboarding` 店舗作成画面

| 要素 | 文言 |
|------|------|
| ページタイトル（`<title>`） | 「店舗登録 \| シフトすけっと」 |
| ロゴ下キャッチ | 「スタッフのシフトを、かんたんに作成できます。」 |
| Card タイトル | 「お店を登録しましょう」 |
| Card サブタイトル | 「店舗名を入力すると、シフト管理を始められます。」 |
| Label | 「店舗名」 |
| Input placeholder | 「例: 渋谷カフェ 本店」 |
| Input ヒント | 「あとから変更できます」 |
| Button（通常時） | 「お店を登録して始める」 |
| Button（送信中） | 「登録中...」 |
| ログアウトリンク | 「ログアウト」 |

**エラーメッセージ:**

| 状況 | メッセージ |
|------|-----------|
| 空文字 | 「店舗名を入力してください」 |
| 100文字超 | 「店舗名は100文字以内で入力してください」 |
| 409「slug衝突」| 「もう一度お試しください」 |
| 422 | 「入力内容を確認してください」 |
| ネットワーク/5xx | 「通信エラーが発生しました。しばらくしてから再試行してください」 |

### 8.2 `/onboarding/getting-started` 初期データガイド画面

| 要素 | 文言 |
|------|------|
| ページタイトル（`<title>`） | 「はじめましょう \| シフトすけっと」 |
| Card タイトル | 「はじめましょう！」 |
| Card サブタイトル | 「4つのステップでシフト作成が始められます。」 |
| ステップ 1 タイトル | 「スタッフを登録する」 |
| ステップ 1 説明 | 「シフトに入るスタッフを追加します。」 |
| ステップ 1 ボタン（未完了） | 「設定画面へ →」 |
| ステップ 1 ボタン（完了済） | 「再設定する →」 |
| ステップ 2 タイトル | 「シフト枠を登録する」 |
| ステップ 2 説明 | 「早番・遅番などの時間帯を登録します。」 |
| ステップ 2 ボタン | （ステップ 1 と同様） |
| ステップ 3 タイトル | 「必要人数を設定する」 |
| ステップ 3 バッジ | 「任意」 |
| ステップ 3 説明 | 「各シフト枠の最低必要人数を設定します。」 |
| ステップ 3 ボタン | 「設定画面へ →」 |
| ステップ 4 タイトル | 「最初のシフトを作成する」 |
| ステップ 4 説明 | 「最適化を実行してシフトを自動生成します。」 |
| ステップ 4 ボタン | 「シフト表へ →」 |
| 「あとで設定する」ボタン | 「あとで設定する」 |
| is_complete 時メッセージ | 「準備が整いました！シフト表でシフトを作成できます。」 |
| is_complete 時 CTA ボタン | 「シフト表を開く」 |
| ログアウトリンク | 「ログアウト」 |

### 8.3 `OnboardingHintCard`（`/schedule` 上）

| 要素 | 文言 |
|------|------|
| タイトル | 「はじめに設定が必要です」 |
| 本文 | 「シフト表を作成するには、スタッフとシフト枠の登録が必要です。」 |
| ガイドリンクボタン | 「初期設定ガイドを見る →」 |
| dismiss ボタン aria-label | 「このお知らせを閉じる」 |

### 8.4 ナビゲーション追加文言

| 要素 | 文言 |
|------|------|
| UserNav 店舗名（状態 C） | `{orgName}`（truncate あり） |
| ページタイトル統一 | 「シフトすけっと」（`app/layout.tsx` の metadata.title を更新） |

### 8.5 `error.tsx`

| 要素 | 文言 |
|------|------|
| Card タイトル | 「エラーが発生しました」 |
| 本文 | 「ページの読み込みに失敗しました。しばらく待ってから再試行してください。」 |
| 再試行ボタン | 「再試行」 |
| ログアウトリンク | 「ログアウト」 |

---

## 9. レスポンシブ対応

### 9.1 ブレークポイント方針

Tailwind CSS デフォルトブレークポイントを使用（Phase 0-1 UI 設計 §5.1 踏襲）。

| ブレークポイント | 幅 | オンボーディング画面の挙動 |
|--------------|-----|--------------------------|
| デフォルト（モバイル） | < 640px | Card `mx-4` ほぼフル幅。ステップ Card 縦スタック |
| `sm` | 640px〜 | Card `max-w-sm`（`/onboarding`）/ `max-w-md`（`/getting-started`）中央寄せ |
| `md` 以上 | 768px〜 | 変化なし（`max-w-md` 固定） |

### 9.2 モバイル対応方針

オンボーディングは管理者（店長）が初回設定で使う画面。スマートフォンからの設定も想定するが、設定作業はデスクトップが主体となる想定でよい。そのため:
- ハンバーガーメニュー実装なし（Phase 0-1 §5.2 と同一方針）。
- カード幅を `mx-4` で確保するだけで可読性は保てる。
- ステップ Card の「設定画面へ」ボタンは `size="sm"` で小さくまとめる。

---

## 10. Worker B / Worker C への引き継ぎ事項

### 10.1 Worker B（フロントエンド オンボーディング画面）向け

**実装順序（推奨）:**

```
1. frontend/app/(onboarding)/layout.tsx         ← (auth)/layout.tsx を複製するだけ
2. frontend/components/onboarding/create-org-form.tsx
3. frontend/app/(onboarding)/onboarding/page.tsx
4. frontend/components/onboarding/getting-started-checklist.tsx
5. frontend/app/(onboarding)/onboarding/getting-started/page.tsx
6. frontend/components/onboarding/onboarding-hint-card.tsx
7. frontend/app/(onboarding)/error.tsx
8. frontend/lib/api.ts への追加（createOrganization / fetchMe 等）
9. frontend/lib/types.ts への追加（Planner §5.9 参照）
10. frontend/app/schedule/page.tsx のバナー置き換え
```

**Tailwind クラス指定（迷わないための具体指示）:**

- `create-org-form.tsx` のラッパー div: `className="w-full max-w-sm mx-4"` (sign-in-form.tsx と同一)
- ロゴ部分: `className="text-center mb-8"` → `<h1 className="text-2xl font-bold">シフトすけっと</h1><p className="text-sm text-muted-foreground mt-2">...</p>`
- `getting-started-checklist.tsx` のステップ Card（未完了）: `className="border border-border rounded-lg p-4 space-y-2"`
- `getting-started-checklist.tsx` のステップ Card（完了済）: `className="border border-border rounded-lg p-4 space-y-2 bg-gray-50 opacity-75"`
- ステップ番号バッジ（未完了）: `className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center shrink-0"`
- ステップ番号バッジ（完了）: `className="text-xs font-bold bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0"`
- 「あとで設定する」ボタン: `<Button variant="ghost" asChild className="mt-2 w-full text-muted-foreground">`
- `OnboardingHintCard` 外枠: `className="rounded-lg border border-amber-200 bg-amber-50 p-4"`
- `OnboardingHintCard` タイトル: `className="font-medium text-amber-800 mb-1 text-sm"`
- `OnboardingHintCard` 本文: `className="text-sm text-amber-700 mb-3"`

**`/schedule/page.tsx` の既存バナー置き換えについき:**
- 現行の `isSetupIncomplete` バナー（行 241〜261）を削除し、`OnboardingHintCard` に置き換える。
- `schedule/page.tsx` を Server Component にはしない（大量のクライアント状態がある）。代わりに、親のレイアウト（または専用のサーバーラッパー）から `onboarding` データを取得して props で渡す形を取る。
- 最もシンプルな実装: `/schedule/page.tsx` の先頭で `fetchMeServer()` を別サーバーコンポーネントに分離して `OnboardingHintCard` を渡す `ScheduleHintWrapper` を作るか、または `page.tsx` 自体をサーバーコンポーネント化して既存のクライアント処理を別コンポーネントに移す。
- **最小変更案（Worker B 推奨）**: `/schedule/page.tsx` は既存クライアントコンポーネントのまま維持し、`OnboardingHintCard` は `staffList.length` と `shiftSlots.length`（既にクライアント state で持っている値）を props に渡す。`OnboardingHintCard` の props を `staffCount: number` / `shiftSlotCount: number` としているのはこのため。この場合、`OnboardingHintCard` へ渡す値はサーバーではなくクライアント state の値になるが、`/schedule` 側でデータ取得後に自動更新されるため機能的には同等。

**409 エラー処理の実装パターン:**

```typescript
// create-org-form.tsx 内のエラーハンドリング例
} catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    if (err.detail === "You already own an organization") {
      // 既所有 → getting-started へリダイレクト（成功と同じ扱い）
      onSuccess();
      return;
    }
    // slug 衝突
    setServerError("もう一度お試しください");
  } else if (err instanceof ApiError && err.status === 422) {
    setServerError("入力内容を確認してください");
  } else {
    setServerError("通信エラーが発生しました。しばらくしてから再試行してください");
  }
}
```

`apiFetch` がどのようにエラーを throw するかは既存 `lib/api.ts` の実装を確認して合わせること。`err.detail` 文字列で 409 の種別を区別する（Planner §4.2 の detail 仕様参照）。

### 10.2 Worker C（middleware + ナビゲーション）向け

**実装順序（推奨）:**

```
1. frontend/lib/api-server.ts（fetchMeServer、Planner §5.8 通り）
2. frontend/lib/types.ts（Planner §5.9 の型追加）
3. frontend/app/page.tsx（サーバーコンポーネント化、3 状態分岐）
4. frontend/app/layout.tsx（サーバーコンポーネント + fetchMeServer 呼び出し + hasOrg 判定）
5. frontend/components/auth/user-nav.tsx（orgName props 追加）
6. frontend/components/main-nav.tsx（新規、ナビリンク 4 件を切り出し）
```

**`app/layout.tsx` 改修の具体的なクラス変更:**

- `metadata.title` を `"シフトすけっと"` に変更（`description` も「シフトすけっと | 小規模店舗のシフト管理」などに更新）
- ヘッダーロゴリンクの文字列を `シフトすけっと` に変更
- `<nav>` 部分を `{hasOrg && <MainNav />}` に変更

**`MainNav` コンポーネント:**

```typescript
// frontend/components/main-nav.tsx
// Server Component。props なし（hasOrg は親 layout から条件レンダリングで対応）
// 内部で fetchMeServer を呼ばない
export function MainNav() {
  return (
    <nav className="flex gap-6">
      <Link href="/settings" className="text-sm font-medium hover:text-primary">設定</Link>
      <Link href="/staff" className="text-sm font-medium hover:text-primary">希望入力</Link>
      <Link href="/view" className="text-sm font-medium hover:text-primary">シフト確認</Link>
      <Link href="/schedule" className="text-sm font-medium hover:text-primary">シフト表</Link>
    </nav>
  );
}
```

**`UserNav` の `orgName` 追加箇所:**

既存の `DropdownMenuContent` 内、`<div className="px-2 py-1.5">` を以下に変更:

```tsx
<div className="px-2 py-1.5 space-y-0.5">
  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
  {orgName && (
    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{orgName}</p>
  )}
</div>
```

`UserNav` の Props 定義に `orgName?: string` を追加。`status === "loading"` の分岐（プレースホルダー表示）は既存のまま維持。

**`app/page.tsx` の fetchMeServer 失敗時のフォールバック:**

`fetchMeServer()` が `null` を返す（401）場合は `redirect("/signin")` とする。`throw` する場合（5xx）は `app/error.tsx`（ルートレベル）に委ねる。

**`app/layout.tsx` での fetchMeServer エラーハンドリング:**

```typescript
// fetchMeServer が null を返したら me = null として続行（session チェックとは別）
const me = session ? await fetchMeServer().catch(() => null) : null;
const hasOrg = (me?.organizations.length ?? 0) > 0;
```

`catch(() => null)` でバックエンドダウン時でもレイアウトがクラッシュしないようにする。

**color-token 使用方針:**

- 操作に関わるテキスト: `text-foreground`（黒）
- 補足説明テキスト: `text-muted-foreground`（グレー）
- エラー/警告: `text-destructive`（shadcn デフォルト赤系）
- 成功: `text-green-600`（shadcn デフォルトにないため直接指定。完了バッジのみ）
- アンバー系（OnboardingHintCard）: `border-amber-200 bg-amber-50 text-amber-800 text-amber-700`

---

## 11. 未解決・後続フェーズへの引き継ぎ

- **店舗名の変更 UI**: Phase 1-1 スコープ外。設定画面への追加は後続フェーズ。
- **`UserNav` への「店舗設定」メニュー項目**: Phase 1-1 では追加しない。ログアウトのみで十分。
- **複数組織所属時の切替 UI**: Planner §9.4 通り、後続フェーズ対応。
- **`OnboardingHintCard` のサーバーフラグによる永続 dismiss**: Phase 1-1 では DB フラグなし。後続フェーズで `users.last_onboarded_at` 等を追加した場合に対応する。
- **「必要人数設定」ステップのカウントロジック**: Planner §5.6 の通り Phase 1-1 では常に「未完了」表示。後続フェーズで `staffing_requirements_count` を `GET /api/me` に追加する。
