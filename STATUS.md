# プロジェクト状況

> 最終更新: 2026-05-02 (Phase 0-1 サブタスク 2: バックエンド内部認証 API 完了) | ブランチ: main

## 現在のフェーズ

**MVP 完成 → 無料SaaS化フェーズ** — 招待制を廃し、2026-06-07 一般公開（フル公開）を目標に運用計画を策定。
- 運用計画: 確定済（未確定事項6項目すべて決定、design-doc-reviewer の Critical/Major 反映済）
- Phase 0-1 認証実装: ✅ 技術設計（Planner）/ ✅ UI 設計（Designer）/ 🚧 Worker 実装中
  - サブタスク 1（DB モデル & マイグレーション 3h）: ✅ 完了
  - サブタスク 2（バックエンド内部認証 API 3h）: ✅ 完了 — 6 エンドポイント、Secret ガード、テスト 82 → 97 件
  - サブタスク 3（Auth.js v5 設定 + HTTP Adapter 4h）: ⏳ 次着手
  - サブタスク 4〜6: 未着手
- 詳細: `docs/plans/2026-04-28-operation-plan.md` / `docs/plans/2026-04-30-phase0-1-auth-design.md` / `docs/plans/2026-04-30-phase0-1-auth-ui-design.md`

## 実装済み機能

### バックエンド (`backend/`)

| 機能 | ファイル | 状態 |
|------|---------|------|
| スタッフ CRUD | `api/staff.py` | ✅ 完了 |
| シフト枠 CRUD | `api/shift_slots.py` | ✅ 完了 |
| 必要人数設定 | `api/staffing_requirements.py` | ✅ 完了 |
| 役割別必要人数 | `api/role_staffing_requirements.py` | ✅ 完了 |
| スタッフ希望入力 | `api/requests.py` | ✅ 完了 |
| スケジュール管理・最適化 | `api/schedules.py` | ✅ 完了 |
| ソルバー設定（制約スイッチ） | `api/solver_config.py` | ✅ 完了 |
| PuLP + SCIP 最適化エンジン | `optimizer/solver.py` | ✅ 完了 |
| 最適化失敗時の診断機能（深化・追加提案付き） | `optimizer/solver.py` | ✅ 完了 |
| 月またぎ連続勤務制約 | `optimizer/solver.py`, `services/schedule.py` | ✅ 完了 |
| 逆循環シフト禁止制約 | `optimizer/solver.py`, `models.py`, `domain.py` | ✅ 完了 |
| スキル・資格配置制約 | `optimizer/solver.py`, `api/skills.py`, `api/skill_requirements.py`, `repositories/skill.py` | ✅ 完了 |
| 公平性ダッシュボードAPI | `api/fairness.py` | ✅ 完了 |

### フロントエンド (`frontend/`)

| 画面 | ファイル | 状態 |
|------|---------|------|
| 設定画面（スタッフ・シフト枠・必要人数） | `app/settings/page.tsx` | ✅ 完了 |
| シフト表画面（最適化・手動編集・公開） | `app/schedule/page.tsx` | ✅ 完了 |
| 希望入力画面 | `app/staff/page.tsx` | ✅ 完了 |
| ナビゲーションレイアウト | `app/layout.tsx` | ✅ 完了 |
| シフト表グリッド（希望表示・合計列・CSVエクスポート） | `components/shift-calendar.tsx` | ✅ 完了 |
| 希望入力カレンダー | `components/request-calendar.tsx` | ✅ 完了 |
| スタッフ管理テーブル | `components/staff-table.tsx` | ✅ 完了 |
| 最適化診断パネル | `components/diagnostics-panel.tsx` | ✅ 完了 |
| 最適化設定パネル | `components/solver-config-panel.tsx` | ✅ 完了 |
| スタッフ向け閲覧画面（読み取り専用・ハイライト） | `app/view/page.tsx` | ✅ 完了 |
| スキル要件設定画面 | `components/skill-requirements-table.tsx`, `app/settings/page.tsx` | ✅ 完了 |
| 公平性ダッシュボード画面 | `components/fairness-dashboard.tsx`, `app/schedule/page.tsx` | ✅ 完了 |
| 業種別プリセット制約テンプレート | `components/solver-config-panel.tsx` | ✅ 完了 |

## テスト状況

```
バックエンド: 73 passed (2026-04-07 時点, 充足不能診断深化テスト追加)
フロントエンド: 66 passed (2026-04-07 時点, 業種別プリセットテスト追加)
E2E (Playwright): 3 passed (2026-04-23 時点, スタッフ/シフト枠追加・期間作成)
```

テスト実行コマンド:
```bash
cd backend && uv run python -m pytest -v
cd frontend && npm run test          # 単体
cd frontend && npm run test:e2e      # E2E (backend/frontend を自動起動)
```

E2E 実行の前提:
- `uv` がインストール済みであること（backend を起動する webServer が `uv run uvicorn` を使う）
- Chromium は `npm run test:e2e` が起動時に `playwright install chromium` を自動実行するので手動インストール不要

## 最近のコミット

| コミット | 内容 |
|---------|------|
| `2359297` | fix: self-bootstrap chromium in test:e2e and document uv prerequisite (#5) |
| `413d136` | test: add Playwright E2E with 3 golden-path scenarios (#4) |
| `b6d2249` | chore: add auto-format hook and Plan Mode checkpoint to /develop (#3) |
| `9f459e4` | docs: restructure roadmap into phase2 candidates with priority/effort table |
| `5e18481` | chore: add PostToolUse hook to remind STATUS.md update on git commit |

## TODO / フェーズ2 候補

| 機能 | 優先度 | 工数 | 概要 |
|------|--------|------|------|
| 希望提出の催促リマインダー | ★★★ | 小 | 未提出スタッフ一覧を管理画面に表示（メール不要） |
| シフト確定通知メール | ★★★ | 中 | 公開時にスタッフへ自動送信（SMTP設定が必要） |
| PDF エクスポート | ★★☆ | 小 | シフト表を PDF 出力（印刷・配布対応） |
| 希望入力の締め切り日設定 | ★★☆ | 小 | 管理者が締め切りを設定・スタッフに表示 |
| 稼働実績の記録・集計 | ★★☆ | 中 | 実績 vs 計画の比較・月次集計ダッシュボード |
| シフト交換申請 | ★★☆ | 大 | スタッフ間申請 → 管理者承認フロー |
| 認証・ログイン機能 | ★☆☆ | 大 | ユーザー認証・スタッフ別マイページ |
| 非同期ジョブ化 | ★☆☆ | 大 | 最適化をバックグラウンド処理化（大規模対応） |

### 完了済み
- [x] フロントエンドテストの整備（Vitest + React Testing Library）
- [x] シフト表の手動編集 UI（ペイントモード）
- [x] 最適化失敗時の原因診断（HiGHS IIS）
- [x] 公平性制約・希望反映の重み設定（バックエンド + UI）
- [x] PostgreSQL 対応（Vercel + Railway デプロイ設定）
- [x] シフト表の CSV エクスポート
- [x] 希望インジケーター・勤務日数合計列（シフトカレンダー拡張）
- [x] 公開済みシフト表のスタッフ向け閲覧画面（/view ページ・行ハイライト）
- [x] 月またぎ連続勤務制約（直前公開済み期間の末尾実績を LP ソルバーに注入）

## 既知の問題・メモ

- テスト実行は `uv run pytest` ではなく `uv run python -m pytest` を使うこと（root から実行時）
- フロントエンドテストは `npm run test` で実行（Vitest + React Testing Library）
- Claude Code の Edit/Write 後に `.claude/hooks/auto-format.sh` が自動で整形実行（frontend: `prettier`, backend: `ruff format` + `ruff check --fix --select=I`）
- `/develop` は Phase 2.5 で Plan Mode 経由のユーザー承認を取得してから実装に進む
- Playwright E2E は専用ポート 3100 (frontend) / 8100 (backend) で起動し、test DB は `backend/e2e_test.db` を毎回 backend 起動前に削除する
- Playwright の `globalSetup` は `webServer` 起動後に実行されるため、test DB の削除は backend 起動コマンドの `rm -f` で行う（重要な落とし穴）
