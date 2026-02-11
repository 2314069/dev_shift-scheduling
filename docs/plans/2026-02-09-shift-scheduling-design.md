# シフトスケジューリングWebアプリ 設計書

## 概要

小規模店舗（5〜20人）向けのシフトスケジューリングWebアプリ。数理最適化（PuLP + SCIP）を使って、労務ルールと必要人数を満たすシフト表を自動生成する。

## 対象ユーザー

- 店舗の店長・マネージャー（シフト管理者）
- 社内の管理部門

## MVP機能

1. スタッフ情報・シフト枠・必要人数の設定
2. スタッフからの希望入力（希望シフト・休み希望・不可）
3. 数理最適化によるシフト自動生成
4. シフト表の表示・手動編集
5. シフト表の公開

## アーキテクチャ

モノレポ・同期実行型。最適化は同期的にAPIレスポンスとして返す。小規模なら数秒で解けるため、ジョブキューは不要。

```
dev-shift-scheduling/
├── frontend/          # Next.js (React)
│   ├── app/           # App Router
│   │   ├── staff/     # スタッフ希望入力画面
│   │   ├── schedule/  # シフト表表示・手動編集画面
│   │   └── settings/  # スタッフ・シフト枠の設定画面
│   └── components/
├── backend/           # FastAPI + PuLP
│   ├── api/           # APIエンドポイント
│   ├── models/        # SQLAlchemyモデル（DB定義）
│   ├── optimizer/     # 数理最適化ロジック
│   └── schemas/       # Pydanticスキーマ（入出力定義）
└── docs/
    └── plans/
```

## データモデル

### Staff（スタッフ）

| カラム | 型 | 説明 |
|---|---|---|
| id | int | PK |
| name | str | 名前 |
| role | str | 役割（例: "リーダー", "一般"） |
| max_days_per_week | int | 週あたりの最大勤務日数 |

### ShiftSlot（シフト枠）

| カラム | 型 | 説明 |
|---|---|---|
| id | int | PK |
| name | str | 枠名（例: "早番", "遅番"） |
| start_time | time | 開始時刻 |
| end_time | time | 終了時刻 |

### StaffRequest（スタッフ希望）

| カラム | 型 | 説明 |
|---|---|---|
| id | int | PK |
| staff_id | int | FK → Staff |
| date | date | 対象日 |
| shift_slot_id | int | FK → ShiftSlot（NULLなら休み希望） |
| type | str | "preferred"（希望）/ "unavailable"（不可） |

### SchedulePeriod（スケジュール期間）

| カラム | 型 | 説明 |
|---|---|---|
| id | int | PK |
| start_date | date | 期間開始日 |
| end_date | date | 期間終了日 |
| status | str | "draft" / "published" |

### ScheduleAssignment（シフト割り当て結果）

| カラム | 型 | 説明 |
|---|---|---|
| id | int | PK |
| period_id | int | FK → SchedulePeriod |
| staff_id | int | FK → Staff |
| date | date | 対象日 |
| shift_slot_id | int | FK → ShiftSlot（NULLなら休み） |
| is_manual_edit | bool | 手動編集フラグ |

### StaffingRequirement（必要人数）

| カラム | 型 | 説明 |
|---|---|---|
| id | int | PK |
| shift_slot_id | int | FK → ShiftSlot |
| day_type | str | "weekday" / "weekend" / 特定曜日 |
| min_count | int | 最低必要人数 |

## 最適化モデル（MVP）

### 決定変数

```
x[s, d, t] ∈ {0, 1}
  s: スタッフ, d: 日付, t: シフト枠
  1ならスタッフsが日付dにシフト枠tに入る
```

### ハード制約

- **1日1シフト**: 各スタッフは1日に最大1つのシフト枠
- **必要人数確保**: 各シフト枠×日付で最低人数を満たす
- **不可日の尊重**: `type="unavailable"`の希望は厳守
- **連勤制限**: N日連続勤務を超えない（例: 6連勤まで）
- **週あたり勤務上限**: `max_days_per_week`を超えない

### 目的関数（MVP）

```
最小化: 必要人数からの超過人数の合計
```

公平性や希望反映は次のフェーズで目的関数に重み付きで追加。

### 実行フロー

1. FastAPIがDBからデータ取得
2. PuLPで上記モデルを構築
3. SCIPで求解（タイムリミット30秒程度）
4. 実行可能解が見つかれば結果をDBに保存
5. 見つからなければエラーメッセージ（どの制約が厳しいか示唆）

## API設計

```
# スタッフ管理
GET    /api/staff           # スタッフ一覧取得
POST   /api/staff           # スタッフ登録
PUT    /api/staff/{id}      # スタッフ更新
DELETE /api/staff/{id}      # スタッフ削除

# シフト枠管理
GET    /api/shift-slots           # シフト枠一覧
POST   /api/shift-slots           # シフト枠登録
PUT    /api/shift-slots/{id}      # シフト枠更新
DELETE /api/shift-slots/{id}      # シフト枠削除

# 必要人数設定
GET    /api/staffing-requirements          # 必要人数一覧
PUT    /api/staffing-requirements/{id}     # 必要人数更新

# スタッフ希望
GET    /api/requests?period_id={id}                # 希望一覧（期間指定）
GET    /api/requests?period_id={id}&staff_id={id}  # 特定スタッフの希望
POST   /api/requests                               # 希望登録・更新（一括）

# スケジュール
POST   /api/schedules                      # 期間作成
GET    /api/schedules/{period_id}          # シフト表取得
POST   /api/schedules/{period_id}/optimize # 最適化実行
PUT    /api/schedules/{period_id}/assignments/{id}  # 手動編集
PUT    /api/schedules/{period_id}/publish  # 公開
```

## 画面構成

### 管理者向け

#### ① 設定画面 `/settings`
- スタッフの登録・編集・削除
- シフト枠の登録・編集（早番・遅番など）
- 時間帯×曜日ごとの必要人数設定
- シンプルなテーブル形式のUI

#### ② シフト表画面 `/schedule`
- カレンダー形式のシフト表（横軸: 日付、縦軸: スタッフ）
- 期間の作成（例: 2026年3月前半）
- 「最適化実行」ボタン → 結果がシフト表に反映
- セルをクリックして手動編集（シフト枠の変更・休みへの変更）
- 手動編集したセルは色を変えて区別
- 「公開」ボタンでスタッフに公開

### スタッフ向け

#### ③ 希望入力画面 `/staff`
- カレンダー上で日付をタップ → 希望シフト or 休み希望 or 不可を選択
- 自分の提出済み希望を確認
- 公開済みのシフト表を閲覧

MVPではスタッフの識別はURLパラメータで簡易的に行う（例: `/staff?id=3`）。認証は後のフェーズで導入。

## 技術スタック

### フロントエンド
- Next.js（App Router）
- TypeScript
- Tailwind CSS
- shadcn/ui

### バックエンド
- Python 3.12+
- FastAPI
- SQLAlchemy
- PuLP + SCIP
- Pydantic

### 開発ツール
- uv（Pythonパッケージ管理）
- npm（Node.jsパッケージ管理）

### データベース
- SQLite（将来的にPostgreSQLへ移行可能）

## ディレクトリ構成

```
dev-shift-scheduling/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # トップ → /scheduleにリダイレクト
│   │   ├── settings/page.tsx
│   │   ├── schedule/page.tsx
│   │   └── staff/page.tsx
│   ├── components/
│   │   ├── shift-calendar.tsx
│   │   └── ...
│   ├── lib/
│   │   └── api.ts
│   └── package.json
├── backend/
│   ├── api/
│   │   ├── staff.py
│   │   ├── shift_slots.py
│   │   ├── requests.py
│   │   └── schedules.py
│   ├── models/
│   │   └── models.py
│   ├── optimizer/
│   │   └── solver.py
│   ├── schemas/
│   │   └── schemas.py
│   ├── main.py
│   └── pyproject.toml
└── docs/
    └── plans/
```

## 将来の拡張

- 認証・ログイン機能
- 公平性制約（勤務日数・夜勤回数の均等化）
- 希望反映の最適化（目的関数への重み追加）
- ヒューリスティクスによる高速解法
- 対応規模の拡大（非同期ジョブ化）
- 自由時間シフトへの対応
- PostgreSQLへの移行
