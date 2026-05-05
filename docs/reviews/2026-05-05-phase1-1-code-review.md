# Phase 1-1 オンボーディング コードレビュー結果

> 作成日: 2026-05-05 / 担当: Reviewer
> 対象コミット: `3c715a9 feat(onboarding): implement Phase 1-1 organization onboarding flow` および main..HEAD 差分
> 判定: **Conditional Pass**

## 総合評価

**Conditional Pass** — Phase 1-1 のスコープは概ね達成されており、主要なセキュリティ要件（テナント分離、認証必須、なりすまし不可）は満たされている。ただし以下の Major 4 件のうち少なくとも Major-1（owner 重複の race condition）と Major-2（fetchMeServer 重複呼び出し）は公開前に修正することが望ましい。残りは公開後の改善で良い。

192 件のバックエンドテストがすべて PASS しており、テナント分離テスト 11 件で越境攻撃が抑止できていることは確認済み。

| 項目 | 件数 |
|------|------|
| Critical | 0 |
| Major | 4 |
| Minor | 8 |
| 設計書からの逸脱 | 2（うち容認 1、要対応 1） |
| 将来課題 | 4 |

---

## 1. Critical 指摘

**該当なし**。本フェーズで本番投入を阻止する重大なセキュリティ脆弱性・データ破壊リスクは検出されなかった。

---

## 2. Major 指摘（公開前に対応すべき問題）

### Major-1: `POST /api/organizations` の owner 重複チェックに race condition がある

- **ファイル**: `backend/backend/api/organizations.py:62-92`
- **責務割当**: Worker A（バックエンド）
- **指摘**:
  - 50-74 行目で「既に owner Member を持つか」を SELECT してフェイルファースト判定し、その後 79-95 行目で INSERT している。
  - SELECT と INSERT の間に同一ユーザーから同時並行リクエストが入ると、両方のリクエストが「owner なし」と判定して両方とも組織を作ってしまう。
  - 設計書 §9.2 の Reviewer チェック項目 2 で「同時並行リクエストでも効くか」が明記。Tester レポート §7 でも「コードレビューで要確認」と申し送り済み。
  - 現状の `OrganizationMember` の UNIQUE 制約は `(user_id, organization_id)` の複合 UNIQUE であり、**「同一ユーザーが別組織で 2 件 owner」を DB レベルで防げない**。
- **対応案**:
  1. `SERIALIZABLE` トランザクション分離レベル、または `SELECT ... FOR UPDATE` を使う（SQLite では効果限定的）
  2. 部分 UNIQUE インデックス: `WHERE role='owner'` を Alembic マイグレーションで追加（最も堅牢）
  3. INSERT 後に再度 COUNT して 2 件以上だったら片方を削除＋ロールバックするコンペンセーションロジック（暫定対処）
- **検証**: `pytest-xdist` や手動の threading で並行リクエスト再現テストを追加するのが望ましい。

### Major-2: `fetchMeServer()` の二重呼び出しによる API 往復重複

- **ファイル**: `frontend/app/page.tsx:30`、`frontend/app/layout.tsx:54`
- **責務割当**: Worker C（フロントエンド middleware + ナビ）
- **指摘**:
  - ユーザーがルート `/` にアクセスすると、Next.js は `app/layout.tsx` と `app/page.tsx` を両方サーバーで評価する。両方が独立に `fetchMeServer()` を呼ぶため、**FastAPI への `/api/me` 往復が 1 リクエスト中に 2 回発生**する。
  - 同様に `/onboarding/getting-started` も root layout と getting-started page が両方 `fetchMeServer()` を呼ぶため 2 回往復。
  - 設計書 §5.5 / UI 設計書 §6.2 では「ルートレイアウトで取得して props で配信」が想定されていたが、実装では各ページが独立に呼んでいる。
- **対応案**:
  1. Next.js の `cache()` ヘルパー（`react`）で `fetchMeServer` をリクエストスコープでメモ化:
     ```typescript
     import { cache } from "react";
     export const fetchMeServer = cache(async () => { ... });
     ```
  2. または `app/page.tsx` から `fetchMeServer()` を取り除き、`app/layout.tsx` だけで取得する
- **影響**: `/api/me` 自体は軽量だが、トラフィック増加に対する効率の悪さは Phase 1-2 以降のレート制限・コスト面で顕在化。

### Major-3: `OnboardingHintCard` のデータソースが設計書の意図から逸脱している

- **ファイル**: `frontend/app/schedule/page.tsx:237-250`
- **責務割当**: Worker B（フロントエンド オンボーディング画面）
- **指摘**:
  - 設計書 §5.6 / UI 設計書 §4.3 では `me.onboarding.staff_count` / `shift_slot_count` を Server Component から props として渡す前提
  - 実装は `staffList.length` / `shiftSlots.length`（クライアント state）を使用（UI 設計書 §10.1 「最小変更案」を採用）
  - **問題**: `apiFetch` 失敗時に `staffList=[]` となり「初期設定が必要」が永続表示される（既に組織所属＋データ投入済みのユーザーにも誤表示）
- **対応案**:
  - 設計書通り `me.onboarding` を Server Component から props で渡す（`/schedule/layout.tsx` を新設して `fetchMeServer()` を呼ぶ）
  - もしくは `apiFetch` 失敗時の `staffListError` フラグを追加してエラー時はカードを非表示にする

### Major-4: 「ログアウト」リンクが GET `/api/auth/signout` を直接叩いている

- **ファイル**: `frontend/components/onboarding/getting-started-checklist.tsx:172-178`
- **責務割当**: Worker B
- **指摘**:
  - Auth.js v5 では `/api/auth/signout` への GET は「サインアウト確認画面」を表示する仕様。実際のログアウトは POST 時。
  - 同フェーズの `create-org-form.tsx:163` と `error.tsx` は正しく `signOut({ callbackUrl: "/signin" })` を使っており、1 箇所だけ実装が異なって一貫性が無い。
- **対応案**:
  - `getting-started-checklist.tsx` のログアウトリンク部分をクライアントコンポーネント化し、`signOut({ callbackUrl: "/signin" })` を使う

---

## 3. Minor 指摘（公開後の改善で良い問題）

### Minor-1: `_generate_slug` の read-then-insert race
- **ファイル**: `backend/backend/api/organizations.py:28-42`
- **責務**: Worker A
- SELECT で衝突確認 → INSERT の race。`IntegrityError` catch で 409 になるためデータ破損は起きないが、SELECT を省いて INSERT 一発＋IntegrityError 時にループ内でリトライの方がシンプル。

### Minor-2: `_generate_slug` のリトライ枯渇時のメッセージが「retry」と矛盾
- **ファイル**: `backend/backend/api/organizations.py:39-42`
- **責務**: Worker A
- 5 回連続衝突は宇宙の終わりなのに `please retry` を返す。Internal slug generation failed (500) の方が誠実。

### Minor-3: `OrganizationCreateRequest.validate_name` のバリデーション機械処理
- **ファイル**: `backend/backend/schemas.py:38-49`
- **責務**: Worker A
- Pydantic v2 では `Field(min_length=1, max_length=100)` + `BeforeValidator(strip)` の方が標準的。i18n や詳細メッセージ表示拡張時に詰まる可能性。

### Minor-4: `MainNav` がサーバー / クライアントナビ間で再レンダされない可能性
- **ファイル**: `frontend/app/layout.tsx:54-55`
- **責務**: Worker C
- `createOrganization` 成功 → `router.push` 直後にルートレイアウトがキャッシュ済みで `MainNav` が一拍遅れて出る可能性。`router.refresh()` を成功時に呼ぶ。

### Minor-5: `app/page.tsx` の dead code `return;`
- **ファイル**: `frontend/app/page.tsx:25, 33, 38`
- **責務**: Worker C
- `redirect()` は throw するため後続の `return;` は実行されない。テストモック対応のためだが `return redirect(...)` の方が綺麗。

### Minor-6: `fetchMeServer` の戻り値判別が不統一
- **ファイル**: `frontend/lib/api-server.ts:31-32`
- **責務**: Worker C
- 401 のみ `null`、それ以外は throw。`app/layout.tsx` は `.catch(() => null)` で全部 null 化、`app/page.tsx` は throw を捕まえていない。挙動の意図を統一またはコメント明示。

### Minor-7: テストフィクスチャの重複
- **ファイル**: `backend/tests/test_api_organizations.py:34-104`、`test_api_me.py:42-113`、`test_onboarding_flow.py:32-101`、`test_tenant_isolation_onboarding.py:37-75`
- **責務**: Worker A / Tester
- `db_engine`, `db_session`, `_make_stub_user`, `_make_client_for_user`, `unauth_client` がほぼ同一実装で 4 ファイルにコピペ。`backend/tests/conftest.py` 共通化が望ましい。

### Minor-8: `OnboardingHintCard` の `dismissed` state がページ遷移でリセット
- **ファイル**: `frontend/components/onboarding/onboarding-hint-card.tsx:26, 31`
- **責務**: Worker B
- UI 設計書 §4.3 に「意図した挙動」と明記済み。改善するなら `sessionStorage`（Phase 1-1 スコープ外）。

---

## 4. 設計書からの逸脱

### 逸脱-1: `OnboardingHintCard` のデータソース変更（容認、Major-3 で改善推奨）
- UI 設計書 §10.1 で「最小変更案」として明示的に容認されているため設計書からの逸脱ではないが、エラー時の振る舞いに弱点（Major-3）。

### 逸脱-2: ログアウトリンク実装方式の不統一（要対応）
- 1 箇所だけ実装が異なる一貫性欠如。Major-4 で対応推奨。

---

## 5. Tester レポート指摘の解消状況

| Tester 指摘 | 解消状況 |
|------------|---------|
| race condition 確認（§7 申し送り） | **未解消** → Major-1 に格上げ |
| E2E バイパスユーザーへの影響 | **解消** — 既存 E2E 3 件全 PASS |
| fairness-dashboard.test.tsx の `act()` 警告 | **既存問題**、本フェーズ対象外 |
| E2E Chromium インストール環境制約 | 環境固有、Phase 1-2 で整備（Tester レポート §8） |

---

## 6. 将来課題（Phase 1-2 以降に持ち越して良い項目）

1. **複数組織対応の組織切替 UI**: 現状 `current_organization` は `members[0]` 固定（`me.py:67-75`）。Phase 0 完了レビュー [#m2] のフォローアップ。
2. **`/api/me` のレート制限・キャッシュ戦略**: Phase 1-4 で Sentry / WAF を入れるタイミングでアプリレイヤキャッシュ（短 TTL）を検討。
3. **slug 編集 UI**: サブドメインテナンシー導入時に追加。
4. **組織名（店舗名）の変更 UI**: UI 設計書 §11 通り、Phase 1-1 スコープ外。

---

## 7. ブロッカー対応の責務割当（一覧）

| 指摘 | 重大度 | 責務 | 公開遅延必要性 |
|------|--------|------|---------------|
| Major-1 race condition | Major | Worker A | 推奨（並行リクエストが想定される本番環境では事故リスクあり） |
| Major-2 fetchMeServer 二重呼び出し | Major | Worker C | 推奨（パフォーマンス・コスト面） |
| Major-3 OnboardingHintCard データソース | Major | Worker B | 任意（エラー時に誤表示するが致命的でない） |
| Major-4 ログアウトリンク実装 | Major | Worker B | 任意（GET でも確認画面経由でログアウトはできる） |
| Minor-1〜8 | Minor | 各担当 | 不要（公開後の継続改善で OK） |

---

## 8. 良かった点

- **テナント分離テスト 11 件は非常に良い網羅性**。なりすましケースまで踏み込んでおり Phase 0-2 の方針を継承できている
- **論理削除組織の除外**が `me.py:48`、`organizations.py:122` の両方で一貫
- **`Cache-Control: no-store`** が `me.py:40` で正しく付与
- **エラーレスポンスにスタックトレース漏れなし**、機密情報露出なし
- **`get_current_user` のみ依存**（`organizations.py:51`）の認可仕様が設計書通りで、組織未所属でも叩ける構造
- **TypeScript で `any` 不使用**、`ApiError` クラスで型安全な 409 detail 判別が可能
- **「店舗」表記統一**（API/コードは `organization`、UI は「店舗」）
- **`_get_or_create_e2e_user` を一切変更していない**判断は適切
- **middleware の fail-close ホワイトリスト方式**は維持
- **CSRF**: Auth.js v5 の JWE Cookie が SameSite で保護されている前提で許容範囲
