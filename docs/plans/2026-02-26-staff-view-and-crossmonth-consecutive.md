# 設計書: スタッフ向け閲覧画面 & 月またぎ連続勤務チェック

> 作成日: 2026-02-26

---

## 機能1: スタッフ向け閲覧画面

### 目的

公開済みシフト表をスタッフが自分で確認できる読み取り専用ページを追加する。

### 要件

- URL: `/view`
- ナビゲーションバーに「シフト確認」リンクを追加
- スタッフがドロップダウンで自分の名前を選択
- 公開済み期間のみ選択可能（draft は非表示）
- チーム全体のシフト表を読み取り専用で表示
- 選択したスタッフの行をハイライト表示

### アーキテクチャ

```
フロントエンド変更のみ（バックエンド変更なし）

app/layout.tsx
└── 「シフト確認」リンクを /view に追加

app/view/page.tsx（新規）
├── スタッフ選択ドロップダウン（GET /api/staff）
├── 期間選択ドロップダウン（GET /api/schedules、published のみ表示）
└── ShiftCalendar（isPublished=true、highlightStaffId prop 追加）

components/shift-calendar.tsx
└── highlightStaffId?: number prop 追加
    └── 指定スタッフの行に強調スタイルを適用
```

### データフロー

1. ページ表示時に `GET /api/staff` と `GET /api/schedules` を並列取得
2. スタッフ・期間を選択後、`GET /api/schedules/{id}` でアサインメント取得
3. ShiftCalendar に `highlightStaffId` を渡してハイライト表示

### UI レイアウト

```
シフト確認
スタッフ: [ドロップダウン]  期間: [ドロップダウン（公開済みのみ）]

[ShiftCalendar - 読み取り専用、選択スタッフ行ハイライト]
```

---

## 機能2: 月またぎ連続勤務チェック

### 目的

月末〜月初にまたがる連続勤務を最適化制約に組み込み、設定した上限を超えないようにする。

### 要件

- 最適化対象期間の直前に公開済み期間が存在する場合のみ適用
  （`published 期間の end_date == 今期 start_date - 1日`）
- 直前期間の末尾 `max_consecutive_days - 1` 日分の勤務実績を取得
- LP ソルバーの連勤制約に「前月の既知勤務日数」を固定値として加算
- 直前公開済み期間がない場合は現行動作のまま（後方互換）

### アーキテクチャ

```
バックエンド変更のみ（フロントエンド変更なし）

backend/api/schedules.py
└── optimize エンドポイント
    ├── 直前公開済み期間を検索（end_date == start_date - 1日）
    ├── 見つかれば末尾 N 日分のアサインメントを取得
    └── prefix_assignments を solver に渡す

backend/optimizer/solver.py
└── solve_schedule() に prefix_assignments 引数を追加
    └── C4 連勤制約で prefix_count を固定値として加算

    変更前: Σ x[s,d,t] for d in window <= max_consecutive_days
    変更後: prefix_count + Σ x[s,d,t] for d in current_window <= max_consecutive_days
```

### prefix_assignments の型

```python
# staff_id -> 直前期間で勤務した日付リスト（末尾 N 日分）
prefix_assignments: dict[int, list[date]]
```

---

## 実装順序

1. 機能1: スタッフ向け閲覧画面（フロントエンドのみ）
2. 機能2: 月またぎ連続勤務チェック（バックエンドのみ）
