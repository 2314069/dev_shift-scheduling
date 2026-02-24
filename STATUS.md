# プロジェクト状況

> 最終更新: 2026-02-24 (シフトカレンダー機能拡張) | ブランチ: main

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
| シフト表グリッド（希望表示・合計列・CSVエクスポート） | `components/shift-calendar.tsx` | ✅ 完了 |
| 希望入力カレンダー | `components/request-calendar.tsx` | ✅ 完了 |
| スタッフ管理テーブル | `components/staff-table.tsx` | ✅ 完了 |
| 最適化診断パネル | `components/diagnostics-panel.tsx` | ✅ 完了 |
| 最適化設定パネル | `components/solver-config-panel.tsx` | ✅ 完了 |

## テスト状況

```
バックエンド: 54 passed (2026-02-24 時点, 診断テスト5件追加)
フロントエンド: 53 passed (2026-02-24 時点, Vitest + React Testing Library)
```

テスト実行コマンド:
```bash
cd backend && uv run python -m pytest -v
cd frontend && npm run test
```

## 最近のコミット

| コミット | 内容 |
|---------|------|
| `0cfc619` | feat: add request indicators, work-day totals, and CSV export to shift calendar |
| `936842e` | chore: update uv.lock for highspy and numpy dependencies |
| `3f2e54a` | feat: use HiGHS IIS for accurate infeasibility diagnosis |
| `00a184b` | feat: add demo data seed script and fix CBC solver timeout |
| `0dbac20` | feat: improve settings page readability for beginners |

## TODO / 次のフェーズ候補

### 短期（工数小・実用性向上）
- [ ] 公開済みシフト表のスタッフ向け閲覧画面
- [ ] 月またぎ連続勤務チェック（例: 月末5連勤+月初3連勤=実質8連勤の検出）

### 中期（差別化につながる）
- [ ] 公平性ダッシュボード（スタッフ別の早番・遅番・土日出勤回数の可視化）
- [ ] 業種別プリセット制約テンプレート（飲食向け・介護向けなど）
- [ ] 充足不能診断の深化（「このスタッフを追加すると解決」まで提案）
- [ ] 逆循環シフト禁止制約（遅番翌日早番の禁止）
- [ ] スキル・資格の配置制約（例: 調理師免許保持者を各シフトに1名以上）

### 長期・要検討
- [ ] シフト確定通知メール（公開時にスタッフへ自動送信）
- [ ] 希望提出の催促リマインダー（未提出スタッフを管理者に通知）
- [ ] シフト交換申請（スタッフ間申請 → 管理者承認フロー）
- [ ] 認証・ログイン機能
- [ ] 非同期ジョブ化（大規模対応）

### 完了済み
- [x] フロントエンドテストの整備（Vitest + React Testing Library）
- [x] シフト表の手動編集 UI（ペイントモード）
- [x] 最適化失敗時の原因診断（HiGHS IIS）
- [x] 公平性制約・希望反映の重み設定（バックエンド + UI）
- [x] PostgreSQL 対応（Vercel + Railway デプロイ設定）
- [x] シフト表の CSV エクスポート
- [x] 希望インジケーター・勤務日数合計列（シフトカレンダー拡張）

## 既知の問題・メモ

- テスト実行は `uv run pytest` ではなく `uv run python -m pytest` を使うこと（root から実行時）
- フロントエンドテストは `npm run test` で実行（Vitest + React Testing Library）
