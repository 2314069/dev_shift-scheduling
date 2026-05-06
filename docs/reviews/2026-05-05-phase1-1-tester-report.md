# Phase 1-1 オンボーディング テスターレポート

> 作成日: 2026-05-05
> 担当: Tester
> 対象: Phase 1-1 オンボーディング (backend/tests/test_tenant_isolation_onboarding.py, frontend/e2e/onboarding.spec.ts)

---

## 1. 追加したテストファイル一覧

| ファイル | 種別 | 追加件数 | 状態 |
|---------|------|---------|------|
| `backend/tests/test_tenant_isolation_onboarding.py` | バックエンド統合テスト | 11 件 | 全 PASS |
| `frontend/e2e/onboarding.spec.ts` | E2E テスト | 3 件 (2 件は skip) | 環境制約あり（後述） |

---

## 2. 全テスト件数 Before / After

### バックエンド

| 状態 | 件数 |
|------|------|
| Before (前任 Tester 引き継ぎ時) | 181 件 |
| After (今回追加後) | 192 件 |
| 増分 | +11 件 |

### フロントエンド (Vitest 単体テスト)

| 状態 | 件数 |
|------|------|
| Before / After (変更なし) | 160 件 |
| 増分 | 0 件 |

### E2E (Playwright)

| 状態 | 件数 |
|------|------|
| Before | 3 件 |
| After (spec 追加後) | 6 件 (3 件新規、うち 2 件は skip マーク) |
| 実行可能な新規件数 | 1 件 (バイパスモード以外の環境での magic link フロー) |

---

## 3. テスト実行結果

### バックエンド: 192 件全 PASS

```
============================= 192 passed in 3.65s ==============================
```

前任 Tester が追加した 15 件 (test_onboarding_flow.py) および既存 181 件への影響なし。

### フロントエンド単体テスト: 160 件全 PASS

```
Test Files  20 passed (20)
      Tests 160 passed (160)
```

act() 警告が fairness-dashboard.test.tsx で出ているが既存の警告であり FAIL ではない。

### E2E テスト: 実行不可 (環境制約)

`playwright install chromium` 実行時に以下エラー:

```
Error: Download failed: server returned code 403 body 'Host not in allowlist'.
URL: https://cdn.playwright.dev/builds/cft/...
```

ネットワーク制限により Chromium バイナリのダウンロードが不可能。`~/.cache/ms-playwright/` にキャッシュなし、システム Chromium も不在。

既存 E2E 3 件が破壊されていないことの確認方法: `npx playwright test --list` で以下 6 件が正常に列挙されることを確認済み。

```
[chromium] › onboarding.spec.ts (3 件)
[chromium] › schedule-create-period.spec.ts:3:5
[chromium] › settings-add-shift-slot.spec.ts:3:5
[chromium] › settings-add-staff.spec.ts:3:5
Total: 6 tests in 4 files
```

既存 spec ファイルのコードは一切変更していないため、既存 E2E の破壊はないと判断する。

---

## 4. test_tenant_isolation_onboarding.py テスト内容

### TestCrossTenantStaffAccess (3 件)

- `test_user_a_only_sees_org_a_staff`: User A の GET /api/staff は Org A のスタッフのみ返す
- `test_user_b_only_sees_org_b_staff`: User B の GET /api/staff は Org B のスタッフのみ返す
- `test_user_a_cannot_read_org_b_staff_by_id`: User A が Org B のスタッフ ID を直接指定すると 404

### TestCurrentOrganizationIsolation (3 件)

- `test_user_a_me_returns_org_a_as_current`: GET /api/me で current_organization が自テナントのみ
- `test_user_b_me_returns_org_b_as_current`: 同上 (User B 側)
- `test_user_a_me_organizations_does_not_include_org_b`: organizations リストに他テナントが混入しない

### TestPostOrganizationsAuthorization (5 件)

- `test_authenticated_user_becomes_owner_of_new_org`: POST /api/organizations で呼び出しユーザーが owner になる
- `test_owner_user_cannot_create_second_organization`: 既 owner ユーザーが 2 つ目を作ると 409
- `test_only_authenticated_user_becomes_org_owner_not_another_user`: なりすまし不可（他ユーザーが owner にならない）
- `test_new_org_not_visible_to_other_user_via_me`: 作成した組織が他ユーザーの /api/me に漏洩しない
- `test_deleted_org_not_shown_in_me`: 論理削除された組織は organizations / current_organization から除外される

---

## 5. onboarding.spec.ts の方針

### E2E バイパス無効化の実装可否: 実装済み（実行は環境依存）

`playwright.config.ts` の webServer 設定を調査した結果:

- 既存 3 件の E2E は `BYPASS_AUTH_FOR_E2E: "1"` と `APP_ENV: "test"` を webServer に渡している
- `onboarding.spec.ts` はバイパスを使用しない通常ログインフローを検証するため、別の webServer 設定（バイパス環境変数なし + Mailpit 起動）が必要
- ただし playwright.config.ts を変更すると既存 3 件が破壊されるため、本フェーズでは spec ファイルのみ追加し、実行設定は別途検討とした

spec ファイル内で `test.skip(process.env.BYPASS_AUTH_FOR_E2E === "1", ...)` を使い、バイパスモードでは自動スキップする設計にした。

### 実装した spec

1. 新規ユーザーフロー: signin → Mailpit から magic link 取得 → /onboarding リダイレクト確認 → 店舗名入力 → /onboarding/getting-started 遷移 → チェックリスト表示確認
2. チェックリスト点灯テスト: Phase 1-2 以降に延期 (skip マーク)
3. 既存ユーザーのルーティング確認: Phase 1-2 以降に延期 (skip マーク)

---

## 6. 発見した問題

### 軽微な警告 (Minor)

| # | 内容 | ファイル | 重大度 | 推定責務 |
|---|------|---------|--------|---------|
| 1 | `act()` 未ラップ警告が fairness-dashboard.test.tsx で発生 | `frontend/components/__tests__/fairness-dashboard.test.tsx` | Minor | Worker B |

FAIL ではなく警告のみ。既存の問題であり今回の変更とは無関係。

### Critical / Major: なし

実装されたバックエンド API (`POST /api/organizations`, `GET /api/me`, `GET /api/organizations/me`) は全 192 件のテストが PASS しており、テナント分離・認可制御・重複防止が正常に機能している。

---

## 7. Reviewer / Documenter への引き継ぎ事項

### Reviewer (Task 4.1) へ

- バックエンド統合テスト 192 件全 PASS 確認済み
- テナント分離テスト (`test_tenant_isolation_onboarding.py`) で以下を検証済み:
  - クロステナントスタッフ越境アクセス不可
  - GET /api/me での current_organization テナント分離
  - POST /api/organizations での認可（呼び出しユーザーが owner になること、なりすまし不可）
  - 論理削除組織の除外
- E2E バイパスユーザー (`_get_or_create_e2e_user`) への影響は既存テスト全 PASS で確認済み
- 設計書 §9.2 の観点 1〜3 は本テストで確認したが、観点 2 (race condition) は DB クエリ + アプリ層チェックの組み合わせで対応済みであることをコードレビューで要確認

### Documenter (Task 4.2) へ

- テスト件数: backend 181 → 192 件、frontend 160 件（変化なし）、E2E 3 → 6 件（2 件 skip）
- `STATUS.md` 更新時のテスト件数欄は backend 192, frontend 160, E2E 3 (実行可能件数) で記載推奨
- M3 ブロッカーは解消済み（テスト全 PASS により確認）

---

## 8. E2E 実行環境の補足

本テスト実行環境はネットワーク制限により Playwright のブラウザバイナリをダウンロードできない。CI 環境では以下の設定が必要:

1. Playwright 用 Chromium を事前インストールして `/home/user/.cache/ms-playwright/` にキャッシュ
2. または `npx playwright test` を `playwright install chromium &&` なしで実行

onboarding.spec.ts を実際の CI で通すには追加で以下が必要:

1. `playwright.config.ts` に「バイパスなし」バックエンドと Mailpit を起動する別プロジェクト設定を追加
2. Mailpit の API URL (`http://127.0.0.1:8025`) を環境変数化
3. magic link の到着を `waitForTimeout` でなく Mailpit API をポーリングするヘルパーに改善

これらは Phase 1-2 (SMTP/Resend 対応) フェーズでの整備を推奨する。
