# プロジェクト状況

> 最終更新: 2026-02-24 (診断機能追加) | ブランチ: main

## 現在のフェーズ

**MVP 完成** — コア機能の実装・テストが完了。次フェーズの機能追加を検討中。

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
| 最適化失敗時の診断機能 | `optimizer/solver.py` | ✅ 完了 |

### フロントエンド (`frontend/`)

| 画面 | ファイル | 状態 |
|------|---------|------|
| 設定画面（スタッフ・シフト枠・必要人数） | `app/settings/page.tsx` | ✅ 完了 |
| シフト表画面（最適化・手動編集・公開） | `app/schedule/page.tsx` | ✅ 完了 |
| 希望入力画面 | `app/staff/page.tsx` | ✅ 完了 |
| ナビゲーションレイアウト | `app/layout.tsx` | ✅ 完了 |
| シフト表グリッド | `components/shift-calendar.tsx` | ✅ 完了 |
| 希望入力カレンダー | `components/request-calendar.tsx` | ✅ 完了 |
| スタッフ管理テーブル | `components/staff-table.tsx` | ✅ 完了 |
| 最適化診断パネル | `components/diagnostics-panel.tsx` | ✅ 完了 |

## テスト状況

```
バックエンド: 54 passed (2026-02-24 時点, 診断テスト5件追加)
フロントエンド: テスト未実装
```

テスト実行コマンド:
```bash
cd backend && uv run python -m pytest -v
```

## 最近のコミット

| コミット | 内容 |
|---------|------|
| (next) | feat: add infeasibility diagnostics for optimizer |
| `8599bf7` | feat: add solver constraint switches and domain model refactoring |
| `8a9b93e` | refactor: improve input UX across all frontend components |
| `e7bed3e` | chore: add Claude multi-agent configuration and CLAUDE.md |
| `9205396` | docs: add shift scheduling design and implementation plans |

## TODO / 次のフェーズ候補

設計書 (`docs/plans/2026-02-09-shift-scheduling-design.md`) に記載の将来拡張より:

### 高優先度
- [ ] フロントエンドテストの整備（Vitest / Playwright）
- [ ] シフト表の手動編集 UI の改善
- [x] 最適化失敗時のエラーメッセージ改善（どの制約が原因か示す）

### 中優先度
- [ ] 公平性制約（勤務日数・夜勤回数の均等化）
- [ ] 希望反映の最適化（目的関数への重み追加）
- [ ] 公開済みシフト表のスタッフ向け閲覧画面

### 低優先度
- [ ] 認証・ログイン機能
- [ ] PostgreSQL への移行
- [ ] 非同期ジョブ化（大規模対応）
- [ ] シフト表の CSV/PDF エクスポート

## 既知の問題・メモ

- テスト実行は `uv run pytest` ではなく `uv run python -m pytest` を使うこと（root から実行時）
- フロントエンドテストは未実装のため、UIの動作確認は手動
