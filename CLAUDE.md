# シフトスケジューリングWebアプリ

> このファイルはプロジェクトのコンテキストを Claude に伝えるためのものです。

## 概要

小規模店舗向けの数理最適化ベースのシフトスケジューリングWebアプリ（MVP）。
スタッフの希望・制約を考慮し、PuLP + SCIP で最適なシフト表を自動生成する。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| バックエンド | FastAPI, SQLAlchemy, Pydantic |
| 最適化エンジン | PuLP, SCIP |
| データベース | SQLite |
| パッケージ管理 | uv (backend), npm (frontend) |

## ディレクトリ構造

```
/
├── backend/                    # FastAPI バックエンド
│   ├── backend/
│   │   ├── main.py             # FastAPI エントリポイント
│   │   ├── database.py         # DB接続設定
│   │   ├── models.py           # SQLAlchemy モデル
│   │   ├── schemas.py          # Pydantic スキーマ
│   │   ├── api/                # APIルーター
│   │   │   ├── staff.py        # スタッフ CRUD
│   │   │   ├── shift_slots.py  # シフト枠 CRUD
│   │   │   ├── staffing_requirements.py  # 必要人数設定
│   │   │   ├── requests.py     # スタッフ希望入力
│   │   │   └── schedules.py    # スケジュール管理 + 最適化
│   │   └── optimizer/
│   │       └── solver.py       # PuLP 最適化エンジン
│   └── tests/                  # バックエンドテスト
├── frontend/                   # Next.js フロントエンド
│   ├── app/                    # App Router ページ
│   │   ├── layout.tsx          # ナビゲーション付きレイアウト
│   │   ├── page.tsx            # ルートリダイレクト
│   │   ├── schedule/page.tsx   # シフト表画面
│   │   ├── settings/page.tsx   # 設定画面
│   │   └── staff/page.tsx      # スタッフ希望入力画面
│   ├── components/             # UIコンポーネント
│   │   ├── shift-calendar.tsx  # シフト表グリッド
│   │   ├── request-calendar.tsx # 希望入力カレンダー
│   │   └── staff-table.tsx     # スタッフ管理テーブル
│   └── lib/
│       ├── api.ts              # API呼び出しユーティリティ
│       └── types.ts            # TypeScript 型定義
├── docs/                       # ドキュメント
│   ├── plans/                  # 設計・実装計画
│   ├── usage-guide.md          # 使い方ガイド
│   └── technical-guide.md      # 技術ガイド
├── .claude/                    # マルチエージェント設定
│   ├── agents/                 # エージェント定義
│   ├── commands/               # カスタムコマンド
│   └── settings.json           # 設定
└── CLAUDE.md                   # このファイル
```

## 開発規約

### 命名規則

- コンポーネント: PascalCase（例: `ShiftCalendar`）
- 関数・変数: camelCase（例: `apiFetch`）
- Python 関数: snake_case（例: `solve_schedule`）
- 定数: UPPER_SNAKE_CASE（例: `API_BASE`）

### コーディング規約

- フロントエンド: TypeScript を使用し、`any` の使用を避ける
- バックエンド: Python 型ヒントを使用
- エラーハンドリングを必ず実装
- コメントは「なぜ」を説明（「何を」はコードで表現）

### Git 規約

- コミットメッセージ: [type]: [description]
  - feat: 新機能
  - fix: バグ修正
  - refactor: リファクタリング
  - docs: ドキュメント
  - test: テスト
  - chore: その他

## マルチエージェント構成

### エージェント一覧

| エージェント | 責務 | モデル |
|-------------|------|--------|
| Orchestrator | タスク分解・分配・進捗管理 | opus |
| Planner | 技術設計（要件、アーキテクチャ、DB、API） | opus |
| Designer | UI/UX設計 | sonnet |
| Worker | 機能実装 + 単体テスト | sonnet |
| Tester | 統合テスト、E2Eテスト | sonnet |
| Reviewer | コードレビュー | opus |
| Documenter | ドキュメント作成 | sonnet |
| Architect | システム改善 | opus |

### 開発フロー

```
/develop コマンドで起動

Orchestrator（タスク分解）
      ↓
Planner（技術設計）
      ↓
Designer（UI/UX設計）
      ↓
Worker × N（並列実装）
      ↓
Tester（統合テスト）
      ↓
Reviewer + Documenter（並列）
      ↓
Orchestrator（最終確認）
```

### 責務境界の厳守

各エージェントは自分の責務のみを実行し、他のエージェントの責務を侵害しない。

- Orchestrator: コードを書かない、レビューしない
- Planner: 実装しない、UI設計しない
- Designer: ロジック実装しない
- Worker: 他の Worker の担当機能に手を出さない
- Tester: バグを修正しない（報告のみ）
- Reviewer: コードを直接修正しない
- Documenter: src/ 配下を編集しない
- Architect: プロダクトコードを編集しない

## 起動方法

```bash
# バックエンド
cd backend && uv run uvicorn backend.main:app --reload --port 8000

# フロントエンド
cd frontend && npm run dev
```

## テスト実行

```bash
cd backend && uv run pytest -v
```

## 学んだ教訓

> 開発を通じて学んだことを `/improve 振り返り` で追記していく

---

## よくある問題と解決策

> 繰り返し発生する問題とその解決策を記録

---

## プロジェクト固有の指示

### 外部API

- 外部API連携なし（ローカル完結）

### 環境変数

- `NEXT_PUBLIC_API_URL`: バックエンドAPI URL（デフォルト: `http://localhost:8000`）
