# プロジェクト状況

> 最終更新: 2026-04-07 (フェーズ2ロードマップ整理) | ブランチ: main

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
```

テスト実行コマンド:
```bash
cd backend && uv run python -m pytest -v
cd frontend && npm run test
```

## 最近のコミット

| コミット | 内容 |
|---------|------|
| `798d5ea` | docs: add technical design document and fix Next.js version / preset table |
| `9da7bf7` | feat: add industry preset templates to solver config panel |
| `5069f41` | feat: add fairness dashboard (early/late/weekend shift visualization) |
| `b663463` | feat: add reverse cycle prohibition and skill staffing constraints |
| `09e9e7f` | feat: staff view page and cross-month consecutive days constraint |

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
