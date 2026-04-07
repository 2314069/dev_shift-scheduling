# 技術設計書

> 最終更新: 2026-04-07 | バージョン: MVP完成（公平性ダッシュボード・充足不能診断深化・業種別プリセット実装済み）

---

## 1. システム概要

### アーキテクチャ図

```
ブラウザ（ユーザー）
    |
    | HTTP / REST API (JSON)
    |
+----------------------------+
|  フロントエンド             |
|  Next.js 16 (App Router)   |
|  TypeScript / Tailwind CSS |
|  shadcn/ui                 |
|  localhost:3000            |
+----------------------------+
    |
    | HTTP / REST API (JSON)
    | NEXT_PUBLIC_API_URL (デフォルト: http://localhost:8000)
    |
+----------------------------+
|  バックエンド               |
|  FastAPI (Python)          |
|  SQLAlchemy + Pydantic     |
|  localhost:8000            |
+----------------------------+
    |
    | SQLAlchemy ORM (SQL)
    |
+----------------------------+
|  データベース               |
|  SQLite                    |
|  (shift_scheduling.db)     |
+----------------------------+
    |
    | (最適化実行時)
    |
+----------------------------+
|  最適化エンジン             |
|  PuLP（モデリング）         |
|  HiGHS / SCIP / CBC        |
|  （ソルバー、優先順に試行） |
+----------------------------+
```

### 主要コンポーネントの役割

| コンポーネント | 役割 |
|-------------|------|
| Next.js フロントエンド | 管理者・スタッフ向けのUI提供。設定・希望入力・シフト表表示・公平性確認を担当 |
| FastAPI バックエンド | REST APIの提供。データの永続化、最適化エンジンの呼び出しを担当 |
| SQLite データベース | スタッフ・シフト枠・希望・スケジュールデータの永続化 |
| PuLP + ソルバー | 制約条件と目的関数を定義し、整数計画問題として最適シフトを求解 |

---

## 2. データモデル設計

### ER図（テキスト表現）

```
StaffModel
  |-- (1:N) StaffRequestModel (staff_id)
  |-- (1:N) ScheduleAssignmentModel (staff_id)
  |-- (1:N) StaffSkillModel (staff_id)

ShiftSlotModel
  |-- (1:N) StaffingRequirementModel (shift_slot_id)
  |-- (1:N) RoleStaffingRequirementModel (shift_slot_id)
  |-- (1:N) SkillRequirementModel (shift_slot_id)

SchedulePeriodModel
  |-- (1:N) ScheduleAssignmentModel (period_id)

SolverConfigModel  ← シングルトン（全体で1レコード）
```

### 各モデルの詳細

#### StaffModel（スタッフ）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | スタッフID |
| name | String | スタッフ名 |
| role | String | 役割（例: "リーダー", "一般"） |
| max_days_per_week | Integer | 週最大勤務日数（デフォルト: 5） |
| min_days_per_week | Integer | 週最低勤務日数（デフォルト: 0） |

#### ShiftSlotModel（シフト枠）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | シフト枠ID |
| name | String | シフト名（例: "早番", "遅番"） |
| start_time | Time | 開始時刻 |
| end_time | Time | 終了時刻 |

#### StaffRequestModel（スタッフ希望）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | 希望ID |
| staff_id | Integer (FK: staff.id) | スタッフID |
| date | Date | 希望日 |
| shift_slot_id | Integer (FK: shift_slots.id) \| NULL | 希望するシフト枠（NULL=日付のみ指定） |
| type | String | 希望種別: "preferred"（希望出勤）または "unavailable"（出勤不可） |

#### SchedulePeriodModel（スケジュール期間）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | 期間ID |
| start_date | Date | 開始日 |
| end_date | Date | 終了日 |
| status | String | 状態: "draft"（下書き）または "published"（公開済み） |

#### ScheduleAssignmentModel（シフト割り当て）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | 割り当てID |
| period_id | Integer (FK: schedule_periods.id) | スケジュール期間ID |
| staff_id | Integer (FK: staff.id) | スタッフID |
| date | Date | 割り当て日 |
| shift_slot_id | Integer (FK: shift_slots.id) \| NULL | 割り当てシフト枠（NULL=休日） |
| is_manual_edit | Boolean | 手動編集されたフラグ（デフォルト: false） |

#### StaffingRequirementModel（必要人数設定）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | 要件ID |
| shift_slot_id | Integer (FK: shift_slots.id) | 対象シフト枠 |
| day_type | String | 曜日区分: "weekday"（平日）または "weekend"（土日） |
| min_count | Integer | 最低必要人数 |

#### RoleStaffingRequirementModel（役割別必要人数）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | 要件ID |
| shift_slot_id | Integer (FK: shift_slots.id) | 対象シフト枠 |
| day_type | String | 曜日区分: "weekday" または "weekend" |
| role | String | 役割名（StaffModel.role と一致） |
| min_count | Integer | 最低必要人数 |

#### StaffSkillModel（スタッフスキル）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | スキルID |
| staff_id | Integer (FK: staff.id) | スタッフID |
| skill | String | スキル・資格名（例: "調理師免許"） |

#### SkillRequirementModel（スキル要件）

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | Integer (PK) | 要件ID |
| shift_slot_id | Integer (FK: shift_slots.id) | 対象シフト枠 |
| day_type | String | 曜日区分: "weekday" または "weekend" |
| skill | String | 必要なスキル名 |
| min_count | Integer | 最低必要人数 |

#### SolverConfigModel（ソルバー設定）

シングルトンテーブル（レコードは常に1件）。詳細は「第6章 SolverConfig 設計」を参照。

---

## 3. API設計

### エンドポイント一覧

#### スタッフ管理 (`/api/staff`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/staff | スタッフ一覧取得 |
| POST | /api/staff | スタッフ新規作成 |
| PUT | /api/staff/{staff_id} | スタッフ情報更新 |
| DELETE | /api/staff/{staff_id} | スタッフ削除 |
| GET | /api/staff/{staff_id}/skills | スタッフのスキル一覧取得 |
| POST | /api/staff/{staff_id}/skills | スタッフにスキル追加 |
| DELETE | /api/staff/{staff_id}/skills/{skill_id} | スタッフのスキル削除 |

#### シフト枠管理 (`/api/shift-slots`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/shift-slots | シフト枠一覧取得 |
| POST | /api/shift-slots | シフト枠新規作成 |
| PUT | /api/shift-slots/{slot_id} | シフト枠更新 |
| DELETE | /api/shift-slots/{slot_id} | シフト枠削除 |

#### 必要人数設定 (`/api/staffing-requirements`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/staffing-requirements | 必要人数設定一覧取得 |
| POST | /api/staffing-requirements | 必要人数設定作成 |
| PUT | /api/staffing-requirements/{req_id} | 必要人数設定更新 |

#### 役割別必要人数 (`/api/role-staffing-requirements`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/role-staffing-requirements | 役割別必要人数一覧取得 |
| POST | /api/role-staffing-requirements | 役割別必要人数作成 |
| DELETE | /api/role-staffing-requirements/{req_id} | 役割別必要人数削除 |

#### スキル要件 (`/api/skill-requirements`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/skill-requirements | スキル要件一覧取得 |
| POST | /api/skill-requirements | スキル要件作成 |
| DELETE | /api/skill-requirements/{req_id} | スキル要件削除 |

#### スタッフ希望 (`/api/requests`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/requests?period_id={id}&staff_id={id} | 希望一覧取得（期間ID必須、スタッフIDはオプション） |
| POST | /api/requests | 希望一括登録（同一スタッフの希望を一括で上書き） |

#### スケジュール管理 (`/api/schedules`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/schedules | スケジュール期間一覧取得 |
| POST | /api/schedules | スケジュール期間作成 |
| GET | /api/schedules/{period_id} | スケジュール取得（期間情報 + 全割り当て） |
| PUT | /api/schedules/{period_id}/assignments/{assignment_id} | 個別割り当て手動更新 |
| PUT | /api/schedules/{period_id}/publish | スケジュール公開 |
| POST | /api/schedules/{period_id}/optimize | 最適化実行 |
| GET | /api/schedules/{period_id}/fairness | 公平性ダッシュボードデータ取得 |

#### ソルバー設定 (`/api/solver-config`)

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/solver-config | 現在のソルバー設定取得 |
| PUT | /api/solver-config | ソルバー設定更新（部分更新対応） |
| POST | /api/solver-config/reset | ソルバー設定をデフォルト値にリセット |

#### ヘルスチェック

| メソッド | パス | 概要 |
|--------|------|------|
| GET | /api/health | ヘルスチェック（`{"status": "ok"}` を返す） |

### 主要なリクエスト/レスポンス形式

#### 最適化実行レスポンス（POST /api/schedules/{period_id}/optimize）

```
OptimizeResponse:
  status: string          # "optimal" | "infeasible" | "timeout"
  message: string         # 結果の説明メッセージ
  assignments: list       # 割り当て結果のリスト（statusが "optimal" の場合のみ）
  diagnostics: list       # 診断アイテムのリスト（infeasible/timeout時に詳細を含む）

DiagnosticItem:
  constraint: string      # 制約識別子（例: "C2_staffing", "C3_unavailable"）
  severity: string        # "error" | "warning"
  message: string         # 日本語の説明メッセージ
  details: list[string]   # 詳細情報（例: 不足が発生した日付と枠）
  suggestions: list[str]  # 改善提案（例: スタッフ追加の提案）
```

#### 希望一括登録（POST /api/requests）

```
リクエスト:
  period_id: int          # スケジュール期間ID
  requests: list          # 希望アイテムのリスト
    - staff_id: int
    - date: string        # "YYYY-MM-DD"
    - shift_slot_id: int | null
    - type: string        # "preferred" | "unavailable"
```

#### 公平性ダッシュボード（GET /api/schedules/{period_id}/fairness）

```
FairnessDashboardResponse:
  staff_metrics: list
    - staff_id: int
    - staff_name: string
    - total_shifts: int     # 総勤務数
    - early_shifts: int     # 早番（シフト名に「早」を含む）
    - late_shifts: int      # 遅番（シフト名に「遅」「夜」を含む）
    - other_shifts: int     # その他
    - weekend_shifts: int   # 土日勤務数
  summary:
    avg_total: float
    avg_early: float
    avg_late: float
    avg_weekend: float
```

---

## 4. 最適化エンジン設計

### 使用ライブラリと求解フロー

PuLP を使って混合整数計画（MIP）モデルを構築し、以下の優先順でソルバーを試行する。

1. HiGHS（`highspy` パッケージが利用可能な場合、IIS取得オプション付きで使用）
2. SCIP（`SCIP_CMD` が利用可能な場合）
3. CBC（PuLP内蔵ソルバー、常に利用可能なフォールバック）

HiGHSが使用されている場合、充足不能（infeasible）時に IIS（Irreducible Infeasible Subsystem）による精度の高い原因特定が可能になる。

### 決定変数

`x[staff_id, date, shift_slot_id]` ∈ {0, 1}

値が1のとき「スタッフsが日付dにシフト枠tに割り当てられる」ことを意味する。

### 目的関数

以下の項を加算して最小化する。

| 識別子 | 内容 | 重み設定 |
|-------|------|---------|
| ベース | 総割り当て人数 - 総必要人数（余剰人員の最小化） | 固定（1） |
| A1 | 希望シフト反映（希望が叶った数を最大化するペナルティ） | weight_preferred（デフォルト: 3.0） |
| A2 | 勤務日数の公平配分（最大勤務数 - 最小勤務数を最小化） | weight_fairness（デフォルト: 2.0） |
| A3 | 土日祝の公平配分（土日勤務の最大 - 最小を最小化） | weight_weekend_fairness（デフォルト: 2.0） |
| C7 | 必要人数ソフト制約（不足量のペナルティ） | weight_soft_staffing（デフォルト: 10.0） |

A1〜A3はトグルで無効化できる。C7は `enable_soft_staffing` が有効な場合に必要人数制約をハード→ソフト化する。

### 制約一覧

#### ハード制約（必ず満たす）

| 識別子 | 内容 | 設定項目 |
|-------|------|---------|
| 制約1 | 1人のスタッフが1日に割り当てられるシフトは最大1つ | なし（常時有効） |
| 制約2 | 各シフト枠×日付で最低必要人数を確保 | enable_soft_staffing=falseの場合のみハード |
| 制約3 | 出勤不可（unavailable）の日には割り当てない | なし（常時有効） |
| 制約4 | 最大連続勤務日数を超える連勤を禁止 | max_consecutive_days（デフォルト: 6日） |
| 制約5 | スタッフ別の週あたり勤務上限を守る | max_days_per_week（スタッフごと） |

#### ソフト制約（トグルで有効化、無効時はスキップ）

| 識別子 | 内容 | 設定項目 |
|-------|------|---------|
| B4 | シフト間インターバル（遅番→早番等の休息時間を確保） | enable_shift_interval, min_shift_interval_hours |
| B5 | 役割別最低必要人数（role別に最低人数を確保） | enable_role_staffing |
| B6 | 週最低勤務日数（スタッフごとの最低出勤を保証） | enable_min_days_per_week |
| B7 | 逆循環シフト禁止（start_time が前日より早いシフトの翌日配置を禁止） | enable_reverse_cycle_prohibition |
| B8 | スキル配置制約（有資格者をシフトに最低人数配置） | enable_skill_staffing |
| C7 | 必要人数ソフト制約（ハード制約の代替）| enable_soft_staffing |

### 月またぎ連続勤務制約

`prefix_assignments` パラメータとして直前公開済みスケジュールの末尾勤務データを渡すことで、月をまたいだ連続勤務も正しく制限される。最適化実行時にサービス層がこのデータを自動取得してソルバーに注入する。

### 充足不能診断（3フェーズ）

最適化が失敗（infeasible）した場合、以下の3フェーズで原因を特定する。

**Phase 1: プリソルブチェック（_presolve_checks）**

ソルバーを使わず算術チェックで明らかな問題を検出する。検出できる問題は以下の通り。

- C2_staffing: 全スタッフが出勤可能でも特定日に人数が足りない
- C3_unavailable: 出勤不可登録が多いため人数が足りない（不可日数が多い上位3名を特定して提案）
- C5_weekly_max: 週の勤務上限合計が必要人日数を下回っている
- B5_role_staffing: 特定役割のスタッフ数が役割別必要人数を下回っている

Phase 1 で問題が検出された場合、Phase 2・3 はスキップして診断結果を返す。

**Phase 2: HiGHS IIS 解析（_diagnose_with_highs_iis）**

HiGHS ソルバーの IIS（最小充足不能部分集合）機能を使って、どの制約が競合しているかを特定する。検出可能な制約は以下の通り。

- staffing → C2_staffing
- unavail → C3_unavailable
- consec → C4_consecutive
- weekly → C5_weekly_max
- interval → B4_interval
- role → B5_role_staffing
- mindays → B6_min_days

HiGHS が利用できない場合、または IIS が空の場合は Phase 3 にフォールバックする。

**Phase 3: 制約緩和テスト（_try_solve_relaxed）**

制約を1つずつ緩和した問題を再ソルブし、解が得られた制約をボトルネックとして報告する。緩和対象は C2_staffing（ソフト化）、C4_consecutive（上限999日化）、C5_weekly_max（週7日に引き上げ）、B4、B5、B6、C3（不可日除去）の順に試行する。

---

## 5. フロントエンド設計

### ページ構成と画面遷移

```
/ （ルート）
  └── /schedule にリダイレクト

/schedule   ← シフト表画面（管理者用メイン画面）
/settings   ← 設定画面（スタッフ・シフト枠・必要人数・ソルバー設定）
/staff      ← スタッフ希望入力画面
/view       ← スタッフ向け閲覧画面（読み取り専用、行ハイライト付き）
```

ナビゲーションバーは `app/layout.tsx` で全ページ共通のレイアウトとして実装される。

### 主要コンポーネント一覧と役割

| コンポーネント | ファイル | 役割 |
|-------------|---------|------|
| ShiftCalendar | components/shift-calendar.tsx | シフト表のグリッド表示。手動編集（ペイントモード）、希望インジケーター表示、勤務日数合計列、CSVエクスポート機能を含む |
| RequestCalendar | components/request-calendar.tsx | スタッフの希望入力カレンダー。preferred/unavailable の日付・シフト枠指定をサポート |
| StaffTable | components/staff-table.tsx | スタッフの一覧・追加・編集・削除。週最大/最低勤務日数・役割・スキルの管理 |
| DiagnosticsPanel | components/diagnostics-panel.tsx | 最適化失敗時の診断結果表示。severity・constraint・details・suggestionsをカード形式で表示 |
| SolverConfigPanel | components/solver-config-panel.tsx | ソルバー設定UI。基本設定・最適化機能・追加制約・業種別プリセットの適用 |
| SkillRequirementsTable | components/skill-requirements-table.tsx | スキル要件の設定UI（シフト枠×曜日区分×スキルの最低人数設定） |
| FairnessDashboard | components/fairness-dashboard.tsx | スタッフ別の早番・遅番・土日勤務回数の可視化ダッシュボード |

### 状態管理の方針

グローバルな状態管理ライブラリ（Redux, Zustand等）は使用しない。各ページコンポーネントが `useState` / `useEffect` で自身に必要なデータを管理し、APIフェッチは `lib/api.ts` の `apiFetch` ユーティリティを介して行う。

コンポーネント間のデータ共有はプロパティ（props）の受け渡しで解決する。

APIクライアントの基本構造:
- `apiFetch<T>(path, options)` — 汎用フェッチラッパー。レスポンスが204（No Content）の場合 `undefined` を返す
- `fetchFairnessDashboard(periodId)` — 公平性ダッシュボード専用ラッパー

---

## 6. SolverConfig 設計

### 全設定項目

SolverConfig はシステム全体で1件のみ存在するシングルトン。`/api/solver-config` で取得・更新できる。

#### 基本設定

| フィールド | デフォルト値 | 説明 |
|----------|------------|------|
| max_consecutive_days | 6 | 最大連続勤務日数（1〜14の整数） |
| time_limit | 30 | 最適化の計算時間上限（秒、5〜300の整数） |
| min_shift_interval_hours | 11 | シフト間の最低休憩時間（時間、enable_shift_interval が有効な場合のみ適用） |

#### ソフト制約のトグルと重み

| フィールド | デフォルト値 | 説明 |
|----------|------------|------|
| enable_preferred_shift | true | 希望シフト反映の有効/無効 |
| weight_preferred | 3.0 | 希望シフト反映の重み（0.5〜10.0） |
| enable_fairness | true | 勤務日数の公平配分の有効/無効 |
| weight_fairness | 2.0 | 公平配分の重み（0.5〜10.0） |
| enable_weekend_fairness | true | 土日祝の公平配分の有効/無効 |
| weight_weekend_fairness | 2.0 | 土日祝公平配分の重み（0.5〜10.0） |
| enable_soft_staffing | false | 必要人数をソフト制約化する（infeasible 回避に有効） |
| weight_soft_staffing | 10.0 | ソフト制約の重み（1〜20の整数） |

#### 追加ハード制約のトグル

| フィールド | デフォルト値 | 説明 |
|----------|------------|------|
| enable_shift_interval | true | シフト間インターバル制約の有効/無効 |
| enable_role_staffing | false | 役割別必要人数制約の有効/無効 |
| enable_min_days_per_week | false | 週最低勤務日数制約の有効/無効 |
| enable_reverse_cycle_prohibition | false | 逆循環シフト禁止の有効/無効 |
| enable_skill_staffing | false | スキル配置制約の有効/無効 |

### 業種別プリセット一覧

フロントエンドの `SolverConfigPanel` に組み込まれており、ボタン1つで設定を一括適用できる。

| プリセットID | 表示名 | 説明 | デフォルトと異なる値 |
|-----------|------|------|---------|
| balanced | バランス型 | 汎用的な標準設定（デフォルト値そのもの） | — |
| food_service | 飲食・サービス業 | 逆循環禁止・公平性重視 | max_consecutive_days=5, enable_reverse_cycle_prohibition=true, weight_preferred=2.0, weight_fairness=3.0, weight_weekend_fairness=3.0 |
| medical | 介護・医療 | スキル・役割配置制約を重視 | enable_role_staffing=true, enable_skill_staffing=true, weight_preferred=2.0 |
| retail | 小売・店舗 | 土日祝・希望反映を強化 | weight_preferred=4.0, weight_weekend_fairness=4.0 |
| flexible | 柔軟型 | 必要人数ソフト制約化・制限を緩和 | max_consecutive_days=7, enable_weekend_fairness=false, enable_shift_interval=false, enable_soft_staffing=true, weight_preferred=5.0, weight_fairness=1.0, weight_soft_staffing=5.0 |

---

## 7. 開発・運用

### 起動手順

```bash
# バックエンド（http://localhost:8000 で起動）
cd backend && uv run uvicorn backend.main:app --reload --port 8000

# フロントエンド（http://localhost:3000 で起動）
cd frontend && npm run dev
```

### テスト実行手順

```bash
# バックエンドテスト（73件、2026-04-07時点）
cd backend && uv run python -m pytest -v

# フロントエンドテスト（66件、Vitest + React Testing Library）
cd frontend && npm run test
```

注意: バックエンドのテスト実行はプロジェクトルートから `uv run pytest` ではなく、`uv run python -m pytest` を使うこと。

### 環境変数

| 変数名 | デフォルト値 | 説明 |
|-------|------------|------|
| NEXT_PUBLIC_API_URL | http://localhost:8000 | バックエンドAPI URL |
| ALLOWED_ORIGINS | http://localhost:3000 | CORS許可オリジン（カンマ区切りで複数指定可） |

### APIドキュメント

バックエンド起動後、`http://localhost:8000/docs` にアクセスすると Swagger UI の自動生成APIドキュメントが確認できる。

### アーキテクチャ上の注意事項

- SolverConfigModel はシングルトン設計。`get_or_create_default()` で初回アクセス時に自動作成される。
- 公平性ダッシュボードの早番/遅番分類は、シフト名に「早」を含む場合を早番、「遅」「夜」を含む場合を遅番として判定する文字列マッチで実装されている。
- スキル配置制約（B8）において、指定スキルを持つスタッフが1人もいない場合は制約をスキップする（infeasible を避けるための安全措置）。
- 最適化ソルバーの優先順は HiGHS > SCIP > CBC。HiGHS が利用可能な場合に限り、infeasible 時の IIS 解析が使用できる。
