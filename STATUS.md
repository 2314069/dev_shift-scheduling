# プロジェクト状況

> 最終更新: 2026-05-06 (Resend/Vercel 本番設定途中まで完了) | ブランチ: main

## 現在のフェーズ

**MVP 完成 → 無料SaaS化フェーズ** — 招待制を廃し、2026-06-07 一般公開（フル公開）を目標に運用計画を策定。
- 運用計画: 確定済（未確定事項6項目すべて決定、design-doc-reviewer の Critical/Major 反映済）
- **Phase 0-1 認証実装: ✅ 完了**（全 6 サブタスク、Auth.js v5 + JWE + Mailpit）
- **Phase 0-2 マルチテナント化: ✅ 実装完了**（全テーブルに `organization_id`、API スコープ徹底、テナント分離テスト追加）
- **Phase 0 完了ゲート（セキュリティレビュー）: ✅ 実施済 + 指摘対応完了**
  - reviewer エージェント結果: Critical 0 件・Major 6 件・Minor 7 件
  - **ブロッカー [#M1] E2E バイパスの fail-close 化**: ✅ 修正完了（`APP_ENV` ホワイトリスト方式 + 契約テスト 6 件）
  - **[#M2] FK 入力のクロステナント検証**: ✅ 完了（staffing/role/skill requirements の `shift_slot_id`、staff_request の `staff_id`/`shift_slot_id`、assignment update の `shift_slot_id` を検証）
  - **[#M4] `bulk_create_requests` の `period_id` 検証復活**: ✅ 完了（period 所属 + 範囲外日付 + staff/slot テナント検証）
  - **[#M5] models.py の `default="default"` 削除**: ✅ 完了（全 10 テーブル）
  - **[#M6] マイグレーション集約方針の文書化**: ✅ 完了（`docs/plans/2026-04-28-operation-plan.md`）
  - **[#m1] `get_current_org_id` で組織論理削除考慮**: ✅ 完了（`Organization.deleted_at IS NULL` JOIN）
  - **[#m3] `_decode_jwe` の except 絞り込み**: ✅ 完了（`JoseError, ValueError, KeyError, JSONDecodeError`）
  - **[#m5] テナント分離テスト拡張**: ✅ 完了（DELETE / FK 越境 / period 越境 / 未所属 403 など 13 件追加、計 15 件）
  - **[#m6] frontend middleware の fail-close 化**: ✅ 完了（NODE_ENV ホワイトリスト方式）
  - **[#m7] マイグレーションのトランザクション統合**: ✅ 完了（`engine.begin()` で単一トランザクション）
  - **ブロッカー [#M3] 新規ユーザーの組織自動付与**: ✅ 解消済み（Phase 1-1 明示オンボーディングで対応）
  - 残 Minor（m2: 複数組織所属時の選択ロジック、m4: verification_tokens クリーンアップ）は将来対応
- **Phase 1-1 オンボーディング: ✅ 完了**（M3 ブロッカー解消、新規ユーザーの組織作成フロー）
  - Orchestrator によるタスク分解完了: `docs/plans/2026-05-05-phase1-1-onboarding-decomposition.md`
  - Planner による技術設計完了: `docs/plans/2026-05-05-phase1-1-onboarding-design.md`（10 項目の意思決定 + API/フロー/Worker 分割）
  - Designer による UI/UX 設計完了: `docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md`（「店舗」表記統一、Card 縦スタックチェックリスト、ghost ボタン採用等）
  - Phase 2.5 設計レビュー: ✅ ユーザー承認済
  - Phase 3 実装完了:
    - Worker A (BE): `api/organizations.py`, `api/me.py` 新規 + ルーター登録 / schemas 追加。バックエンド 126 → 166 tests (+40)
    - Worker B (FE オンボ画面): `(onboarding)/` ルートグループ、`CreateOrgForm` / `GettingStartedChecklist` / `OnboardingHintCard` + ページ
    - Worker C (FE middleware/ナビ/ルート): `app/page.tsx` サーバー化 + 3 状態分岐、`MainNav` 抽出、`schedule` ページに `OnboardingHintCard` 埋め込み
    - フロントエンド 75 → 160 tests (+85)、全 PASS
    - 表記統一「店舗」、slug は `uuid.uuid4().hex[:12]` 自動生成、JWT 拡張なし、スキーマ変更なし
  - Phase 4 テスト完了: backend 192 / frontend 160 / E2E 6 (3 skip)
  - テスターレポート: `docs/reviews/2026-05-05-phase1-1-tester-report.md`
  - Phase 5 レビュー: `docs/reviews/2026-05-05-phase1-1-code-review.md`（Conditional Pass / Critical 0 / Major 4 / Minor 8）
  - Phase 5.5 差し戻し対応:
    - **Major-1 owner 重複 race condition**: ✅ 修正完了（部分 UNIQUE インデックス追加 / Alembic `0002_add_uq_one_owner_per_user.py`、INSERT→IntegrityError catch、+3 件テスト）
    - **Major-2 `fetchMeServer` 二重呼出**: ✅ 修正完了（react の `cache()` でリクエストスコープメモ化）
    - **Major-3 `OnboardingHintCard` 誤表示**: ✅ 修正完了（`referenceDataLoaded` フラグで apiFetch 失敗時のカード非表示ガード）
    - **Major-4 ログアウトリンク統一**: ✅ 修正完了（`SignOutLink` クライアントコンポーネントを新規作成し、全 3 箇所で `signOut()` に統一）
    - Minor-1, Minor-2, Minor-5 も同時に対応
    - 残 Minor (Pydantic v2 標準化、router.refresh、フィクスチャ共通化等) は将来課題に送り
  - 最終テスト件数: backend 192 → **195** / frontend 160 → **163** すべて PASS
- **Phase 1-7 Alembic 導入: ✅ 完了**（Railway PostgreSQL 用マイグレーション体制）
  - `backend/alembic/` ディレクトリ + 初期マイグレーション `0001_initial_schema.py`
  - `DATABASE_URL` 環境変数で SQLite (dev) / PostgreSQL (prod) 両対応、SQLite では `render_as_batch=True` で ALTER TABLE 互換
  - `_run_migrations` を撤去し、`apply_migrations(engine)` が `alembic upgrade head` を起動時に実行（`AUTO_MIGRATE=0` で無効化可能）
  - Pre-Alembic な既存 DB に対しては自動的に `alembic stamp head` する救済を実装
  - 運用フローを `docs/technical-guide.md` に追記
- **Phase 1-2 SMTP 設定: 🟡 アプリ側完了 / Resend DNS・Vercel 設定完了 / Backend デプロイ待ち**
  - Nodemailer SMTP 設定を `EMAIL_SERVER_HOST/PORT/SECURE/USER/PASSWORD` から構成するよう修正
  - Mailpit は認証なし、Resend は `smtp.resend.com:465` + `EMAIL_SERVER_USER=resend` + API key で利用可能
  - `.env.example` と `docs/technical-guide.md` に Resend / SPF / DKIM / DMARC 反映手順を追記
  - Resend ドメイン `shift-suketto.com` は verified 済み（DKIM / MX / SPF）。送信リージョンは Tokyo (`ap-northeast-1`)
  - Vercel プロジェクト `dev-shift-scheduling` 作成済み。Root Directory は `frontend`
  - Vercel 本番環境変数は SMTP / `AUTH_SECRET` / `INTERNAL_AUTH_SECRET` / `NEXTAUTH_URL=https://dev-shift-scheduling.vercel.app` まで設定済み
  - 残作業: Railway に backend + PostgreSQL を作成し、backend URL を Vercel の `BACKEND_INTERNAL_URL` / `NEXT_PUBLIC_API_URL` に設定して再デプロイ。本番 Magic Link smoke はその後に実施
- 詳細: `docs/plans/2026-04-28-operation-plan.md` / `docs/plans/2026-04-30-phase0-1-auth-design.md` / `docs/plans/2026-04-30-phase0-1-auth-ui-design.md` / `docs/technical-guide.md` (Alembic 運用)

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
| 組織管理 API | `api/organizations.py`, `api/me.py` | ✅ 完了 |
| アカウント・組織削除 API | `api/me.py` (`DELETE /api/me`), `api/organizations.py` (`DELETE`) | ✅ 完了 (Phase 1-8) |
| ログマスキング（個人情報保護） | `backend/logging_config.py` (`SensitiveDataFilter`) | ✅ 完了 (Phase 1-6) |

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
| 希望未提出スタッフ一覧（催促リマインダー） | `app/schedule/page.tsx` | ✅ 完了 |
| オンボーディング画面 | `app/(onboarding)/` | ✅ 完了 |
| アカウント削除画面 | `app/account/delete/page.tsx`, `components/account/delete-account-form.tsx` | ✅ 完了 (Phase 1-8) |

## テスト状況

```
バックエンド: 228 passed (2026-05-05 時点, Phase 1-6 ログマスキング +16 件含む)
フロントエンド: 168 passed (2026-05-05 時点, アカウント削除フォーム +5 件含む)
E2E (Playwright): 6 specs (うち 3 件 skip, 2026-05-05 時点, onboarding.spec.ts 追加)
※ main の希望未提出スタッフリマインダー統合後の再確認が必要（2026-05-06 時点）
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
| `941d06e` | feat(auth): support production SMTP settings |
| `d3b6852` | fix: make e2e and alembic config work on Windows |
| `206db17` | merge: integrate onboarding branch into main |
| `55e0b8e` | test(onboarding): add tenant isolation tests, e2e spec, tester report |
| `472beaf` | test(onboarding): add Phase 1-1 integration flow tests (15 cases) |

## TODO / フェーズ2 候補

| 機能 | 優先度 | 工数 | 概要 |
|------|--------|------|------|
| ~~希望提出の催促リマインダー~~ | — | — | ✅ 実装完了（2026-05-06）未提出スタッフ一覧をシフト表画面に表示 |
| シフト確定通知メール | ★★★ | 中 | 公開時にスタッフへ自動送信（SMTP設定が必要） |
| PDF エクスポート | ★★☆ | 小 | シフト表を PDF 出力（印刷・配布対応） |
| 希望入力の締め切り日設定 | ★★☆ | 小 | 管理者が締め切りを設定・スタッフに表示 |
| 稼働実績の記録・集計 | ★★☆ | 中 | 実績 vs 計画の比較・月次集計ダッシュボード |
| シフト交換申請 | ★★☆ | 大 | スタッフ間申請 → 管理者承認フロー |
| ~~認証・ログイン機能~~ | — | — | ✅ Phase 0-1 で実装完了（2026-05-02） |
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
- [x] Phase 1-1 オンボーディング（新規ユーザーの組織作成フロー、M3 ブロッカー解消）（2026-05-05）

## 既知の問題・メモ

- テスト実行は `uv run pytest` ではなく `uv run python -m pytest` を使うこと（root から実行時）
- フロントエンドテストは `npm run test` で実行（Vitest + React Testing Library）
- Claude Code の Edit/Write 後に `.claude/hooks/auto-format.sh` が自動で整形実行（frontend: `prettier`, backend: `ruff format` + `ruff check --fix --select=I`）
- `/develop` は Phase 2.5 で Plan Mode 経由のユーザー承認を取得してから実装に進む
- Playwright E2E は専用ポート 3100 (frontend) / 8100 (backend) で起動し、test DB は `backend/e2e_test.db` を毎回 backend 起動前に削除する
- Playwright の `globalSetup` は `webServer` 起動後に実行されるため、test DB の削除は backend 起動コマンドの `rm -f` で行う（重要な落とし穴）
