# Phase 1-1 オンボーディング タスク分解

> 作成日: 2026-05-05 / 担当: Orchestrator / 対象: Phase 1-1（運用計画 10h 想定）
> 前提:
> - Phase 0-1 認証 (Auth.js v5 + JWE) 完了
> - Phase 0-2 マルチテナント (`organization_id` 付与・テナント分離) 完了
> - 残ブロッカー [#M3]「新規ユーザーの組織自動付与」を本フェーズで解消する

## 1. 要件整理

### 1.1 機能要件 (FR)

| # | 要件 | 関連 UI/API |
|---|------|-------------|
| FR-1 | 新規サインインで `User` レコードは作成されるが `OrganizationMember` が無い場合、UI を「組織作成画面」に強制誘導する | `frontend/middleware.ts` または `lib/api.ts`, 新規 `/onboarding` ページ |
| FR-2 | 組織作成画面で組織名 + slug を入力すると `Organization` と `OrganizationMember(role=owner)` が同一トランザクションで作成される | 新規 API: `POST /api/organizations`（自分の組織を作る公開エンドポイント） |
| FR-3 | slug は重複不可 (`Organization.slug` UNIQUE)。サーバーエラーをユーザー可読なバリデーションメッセージへ変換する | API + フロント |
| FR-4 | 組織作成完了後、所属組織が空（スタッフ 0 人 / シフト枠 0 件）のときは「初期データ投入ガイド」を表示する | 新規 `/onboarding/getting-started` または `/schedule` 上のチェックリストカード |
| FR-5 | ナビゲーションは 3 状態に応じて表示を切り替える: A) 未ログイン B) ログイン済み・組織未所属 C) ログイン済み・組織所属あり | `frontend/app/layout.tsx`, `components/auth/user-nav.tsx` |
| FR-6 | 組織所属済みの既存ユーザーには本フェーズのフロー変更は無影響。`/schedule` 等は今まで通り表示される | middleware / 401-gating の見直し |
| FR-7 | サインアウトは既存 `UserNav` のまま使えること（破壊しない） | 既存 |

### 1.2 非機能要件 (NFR)

- **既存 32 エンドポイントの 403 挙動を維持**: 組織未所属ユーザーが業務 API を叩いた場合は 403（現状の `get_current_org_id` の挙動と一致）。フロント側で先に `/onboarding` に誘導するため、定常運用では 403 はほぼ起きない想定。
- **既存テスト 126 (backend) + 75 (frontend) + 3 (E2E) を破壊しない**。
- **E2E バイパス（`backend/backend/auth.py` の `_get_or_create_e2e_user`）と整合**: Phase 0-2 で組織と Member を auto upsert している既存挙動は維持し、`APP_ENV` ホワイトリスト方式を本フェーズでも崩さない。
- **Phase 0-1 設計書 §7.3 との整合**: 当時「初回サインインで自動的にデフォルト組織を作成」と仮置きされていたが、本フェーズで明示オンボーディングに切り替える。設計書側の追記が必要。
- **JWT クレーム `current_organization_id` の扱い**: 現状は `get_current_org_id` が DB 側 `OrganizationMember` を最終的な真実としているため、JWT に注入する必要は無い（Phase 0-1 §4.2 の仕様は将来対応のまま据え置き）。

### 1.3 スコープ外（明確化）

- 招待リンク・既存組織への参加フロー → Phase 1-x 後送り（運用計画には未記載）
- 複数組織所属時の組織切替 UI → Phase 0 完了レビューの Minor [#m2]、本フェーズでは対象外
- RBAC（owner/admin/member の権限分岐） → Phase 0-3
- サンプルデータ自動投入（CSV プリセット読込など） → 本フェーズでは「ガイド表示」のみ。実投入は既存 CRUD で行う
- 退会（組織削除）UI → Phase 1-8

---

## 2. タスク分解

### フェーズ 1: 設計（直列）

- [ ] **Task 1.1: 技術設計** → **Planner**
  - 入力: 本ドキュメント、`2026-04-28-operation-plan.md`、`2026-04-30-phase0-1-auth-design.md` §7.3
  - 成果物: `docs/plans/2026-05-05-phase1-1-onboarding-design.md`
  - 決定すべき事項:
    1. 「個人用組織自動作成」 vs 「明示オンボーディング画面」のどちらを採用するか（§4 トレードオフ参照）
    2. 組織未所属判定の置き場所（フロント middleware / バックエンド `/api/me` / 401 fallback のどれか、もしくは併用）
    3. 公開 API `POST /api/organizations`（自分用組織作成）の認可仕様 — 認証必須・1 ユーザーが自分専用の組織を 1 つだけ作れる、など
    4. slug 自動生成ロジック（メールローカル部 + ランダム N 桁 / 組織名 kebab-case 化 / 衝突時のリトライ戦略）
    5. ナビゲーションの 3 状態判定 API（`GET /api/me` の戻り値設計: `user`, `organizations`, `current_organization`）
    6. 「初期データガイド」の判定ロジック — `staff_count == 0 && shift_slot_count == 0` を返す API or フロントで個別取得
  - 注意: UI 詳細・コンポーネント分割には踏み込まない（Designer の責務）

- [ ] **Task 1.2: UI/UX 設計** → **Designer**（Task 1.1 完了後）
  - 入力: Task 1.1 成果物、`2026-04-30-phase0-1-auth-ui-design.md`（既存トーン）
  - 成果物: `docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md`
  - 設計対象画面:
    1. `/onboarding`（組織作成画面） — Card レイアウト・フォーム（組織名、slug プレビュー）
    2. `/onboarding/getting-started`（初期データガイド） — チェックリスト形式（スタッフ登録 → シフト枠登録 → 必要人数設定 → 最適化実行 を段階表示）
    3. ナビゲーションの 3 状態切替 — 既存 `app/layout.tsx` + `user-nav.tsx` の最小改修
    4. 既存ホーム `/`（現在 `/schedule` リダイレクトのみ）の状態別ルーティング
  - 注意: ロジック実装に踏み込まない、shadcn/ui の既存コンポーネントを優先

### フェーズ 2: 実装（並列可、3 ワーカー）

- [ ] **Task 2.1: バックエンド — 組織作成 API & `/api/me`** → **Worker A**
  - 入力: Task 1.1 設計
  - 成果物:
    - `backend/backend/api/organizations.py`（新規ルーター）: `POST /api/organizations`, `GET /api/organizations/me`（自分の所属組織一覧）
    - `backend/backend/api/me.py` または `auth.py` に `GET /api/me` を追加（user + organizations + onboarding 状態を返す）
    - `backend/backend/schemas.py` に必要なリクエスト/レスポンス型を追加
    - `backend/backend/main.py` にルーター登録
    - 単体テスト: `backend/tests/test_api_organizations.py`, `test_api_me.py`
  - 担当外: フロント実装、E2E、既存 32 エンドポイントの修正
  - 注意:
    - `POST /api/organizations` は `Depends(get_current_user)` のみ（`get_current_org_id` を使わない — 組織未所属でも叩ける必要がある）
    - slug 衝突時は 409 を返す
    - 同一ユーザーが複数の自分用組織を作れるか／作れないかは Task 1.1 の判断に従う（推奨: 1 ユーザー = 当面 1 owner 組織まで）
    - トランザクション内で `Organization` と `OrganizationMember(role=owner)` を作成

- [ ] **Task 2.2: フロントエンド — オンボーディングフロー** → **Worker B**
  - 入力: Task 1.1 + Task 1.2 + Task 2.1 の API 仕様（API 仕様確定後に着手）
  - 成果物:
    - `frontend/app/(onboarding)/onboarding/page.tsx`（組織作成画面）
    - `frontend/app/(onboarding)/onboarding/getting-started/page.tsx`（初期データガイド）
    - `frontend/app/(onboarding)/layout.tsx`(認証ページと同様にナビ非表示の専用レイアウト)
    - `frontend/components/onboarding/create-org-form.tsx`
    - `frontend/components/onboarding/getting-started-checklist.tsx`
    - `frontend/lib/api.ts` に `createOrganization`, `fetchMe` 等のラッパー追加（`apiFetch` のセマンティクスは変えない）
    - 単体テスト: `frontend/components/onboarding/__tests__/*.test.tsx`
  - 担当外: middleware の改修（Worker C）、バックエンド API（Worker A）

- [ ] **Task 2.3: フロントエンド — middleware & ナビゲーション切替** → **Worker C**
  - 入力: Task 1.1 設計、Task 2.1 の `/api/me` レスポンス仕様
  - 成果物:
    - `frontend/middleware.ts` 改修: 組織未所属ユーザーは `/onboarding` 以外の保護ルートへアクセスしようとすると `/onboarding` にリダイレクト。`/onboarding` のみは認証済みでも組織未所属でアクセス可
    - `frontend/app/page.tsx`（現状 `/schedule` 一律リダイレクト）の状態別分岐: 未認証 → `/signin`、認証済 + 組織なし → `/onboarding`、認証済 + 組織あり → `/schedule`
    - `frontend/app/layout.tsx`: ナビリンクを「組織所属あり」のときのみ表示（現状は `useSession` だけで分岐しているのを、`/api/me` の結果も加味した表示に拡張）
    - `frontend/components/auth/user-nav.tsx` 微修正（メニュー項目に「組織情報」等を加えるかは Designer 判断）
    - 単体テスト: `frontend/__tests__/middleware.test.ts`（既存があれば拡張）
  - 担当外: オンボーディング画面そのもの（Worker B）、API 実装（Worker A）
  - 注意:
    - middleware は Edge Runtime のため、`/api/me` 呼び出しは middleware では行わず、JWT の `sub` に紐づく組織所属情報をどうするかは Task 1.1 の判断に従う（候補: A) middleware では認証チェックのみ行い組織判定はサーバーコンポーネント側、B) JWT に `has_org` フラグを追加する callback を Auth.js に追加）
    - 既存 E2E バイパス（`E2E_DISABLE_AUTH=1` + `NODE_ENV=development|test`）の挙動を壊さない
    - Cypress / Playwright が依存している既存ルーティングを壊さない

### フェーズ 3: テスト（直列）

- [ ] **Task 3.1: 統合テスト & E2E** → **Tester**
  - 入力: Task 2.1〜2.3 の実装
  - 成果物:
    - `backend/tests/test_onboarding_flow.py`（統合）: 新規ユーザー作成 → `/api/me` で `organizations: []` 返却 → `POST /api/organizations` → 再度 `/api/me` で 1 件返却 → 業務 API が 200 になる、を検証
    - `backend/tests/test_tenant_isolation_onboarding.py`: 組織 A のユーザーが組織 B を新規作成したときに、A・B 両方の Member になっているケースの扱い（仕様確認）。クロステナントで他組織を「自分のもの」にできないこと
    - `frontend/e2e/onboarding.spec.ts`: Mailpit から magic link 取得 → 初回サインイン → `/onboarding` に到達 → 組織作成 → `/onboarding/getting-started` 表示 → スタッフ 1 人作成でチェック点灯 → `/schedule` 到達
    - 既存 E2E が PASS することの確認（バイパス組織が事前注入される現状動作）
  - 担当外: バグの修正（報告のみ）

### フェーズ 4: 仕上げ（並列可）

- [ ] **Task 4.1: コードレビュー** → **Reviewer**
  - 入力: Task 2.x の差分、Task 3.1 のテストレポート
  - 観点:
    1. 認可漏れ（`POST /api/organizations` の認証必須化、自分以外の組織を作れないこと）
    2. テナント分離: 新規 API が他テナントへ越境していないか
    3. `_get_or_create_e2e_user` との整合（バイパス時に組織自動付与している既存挙動を本フェーズが破壊していないか）
    4. middleware の fail-close ホワイトリストが維持されているか
    5. 1 ユーザー多重組織作成の DoS 抑止（簡易レート制限の必要性判断）
    6. slug 入力のサニタイズ（XSS, SQL inj は SQLAlchemy で防げているはず）
  - 成果物: レビューコメント (PR コメント or `docs/reviews/2026-05-05-phase1-1-review.md`)。コード変更はしない

- [ ] **Task 4.2: ドキュメント更新** → **Documenter**
  - 入力: Task 2.x の実装、Task 1.1/1.2 の設計
  - 成果物:
    - `docs/usage-guide.md`: 「初めて使う方へ」セクション追加（サインイン → 組織作成 → 初期データ投入の流れ）
    - `STATUS.md`: M3 ブロッカーを ✅ に更新、Phase 1-1 完了反映、最近のコミット欄更新、最終更新日
    - `CHANGELOG.md`(無ければ新規): Phase 1-1 エントリ
    - 必要に応じて `docs/technical-guide.md` に「組織モデルと所属判定」セクション追記
  - 担当外: `src/`, `backend/backend/`, `frontend/` 配下の編集

---

## 3. 依存関係グラフ

```
Task 1.1 (Planner)
    │
    ├──► Task 1.2 (Designer)
    │         │
    │         ▼
    │    [API仕様確定]
    │         │
    │   ┌─────┼──────┐
    │   ▼     ▼      ▼
    │  2.1   2.2    2.3       ← フェーズ2 並列
    │ (BE)  (FE-OB) (FE-MW)
    │   │     │      │
    │   └─────┼──────┘
    │         ▼
    │      Task 3.1 (Tester)
    │         │
    │   ┌─────┴─────┐
    │   ▼           ▼
    │  4.1         4.2        ← フェーズ4 並列
    │ (Review)    (Docs)
```

### クリティカルパス

`1.1 → 1.2 → 2.2 → 3.1 → 4.x`（Designer 出力に最も依存するのは Worker B のフロント実装）

### 並列化のポイント

- **Task 2.1（BE）は Task 1.2 を待たず、Task 1.1 完了直後に着手可能**（API 仕様は Planner が決める）。Worker A は最も早く着手して Worker B/C に API モックを供給する役割
- **Task 2.2 と 2.3 は API モック合意後は完全並列**
- **Task 4.1 と 4.2 は完全並列**

### 推奨工数配分（10h バジェット）

| Task | 推定 | 累積 |
|------|------|------|
| 1.1 Planner | 1.5h | 1.5h |
| 1.2 Designer | 1.0h | 2.5h |
| 2.1 BE | 2.0h | 4.5h |
| 2.2 FE-OB | 2.0h | 6.5h（2.1 と並列で実時間 +1.5h） |
| 2.3 FE-MW | 1.5h | 8.0h（2.2 と並列で実時間 0h） |
| 3.1 Tester | 1.5h | 9.5h |
| 4.1/4.2 並列 | 0.5h | 10.0h |

並列化を活用すれば 10h 内に収まる見込み。バッファ余裕は薄いので、Task 1.1 で複雑な仕様（JWT 拡張など）を選んだ場合は工数増のリスクあり。

---

## 4. トレードオフ整理（Planner 判断材料）

### 4.1 個人用組織の自動作成 vs 明示オンボーディング

| 軸 | 自動作成（A 案） | 明示オンボーディング（B 案、推奨） |
|----|------------------|-----------------------------------|
| ユーザー操作の少なさ | ◎ サインイン直後に即利用可能 | △ 1 画面追加 |
| 組織名の妥当性 | × `user@example.com の組織` のような無味な命名になる | ◎ ユーザーが店舗名等を入力できる |
| Phase 0-1 設計書との整合 | ◎ §7.3 仮置きと一致 | △ 設計書修正が必要 |
| 退会・複数組織の将来拡張 | △ デフォルト組織の扱いが曖昧化しやすい | ◎ 「自分が作った組織」が明示される |
| 実装コスト | ◎ Auth.js コールバック内で 1 回 INSERT | △ 画面 1 + API 1 が増える |
| サインアップ時のドロップオフ | ◎ なし | △ 1 ステップ追加 |
| プロダクトとしての適合性 | △ 個人ユーザー向け SaaS の印象 | ◎ 「店舗の管理者」が使う前提に合う |

**Orchestrator の見解**: B 案推奨。理由は (i) 本プロダクトは店長が複数のスタッフを管理するため、最初に「店舗名」を入力させるほうが UX として自然、(ii) Phase 1-8 退会フローや将来の招待フローと整合させやすい。最終判断は Planner に委ねる。

### 4.2 slug 自動生成方針

| 案 | メリット | デメリット |
|----|----------|-----------|
| ユーザー入力（手動） | URL 重複制御が明示的 | UX 負担、kebab-case 知識を要求 |
| 組織名から自動生成（kebab-case + ランダム 4 桁） | 入力負担なし | 日本語組織名は ASCII 化が困難（romaji 化が必要） |
| ハイブリッド（自動生成 + 編集可） | UX とコントロール両立 | 実装やや複雑 |

**Orchestrator の見解**: 当面 slug は **URL に露出させない**前提なら自動生成（UUID 短縮 or タイムスタンプ）で十分。サブドメインテナンシー（`{slug}.shift-suketto.jp`）導入時に編集 UI を後付けするのが合理的。

### 4.3 初期データガイドの UI 形態

| 案 | 適合性 |
|----|--------|
| 専用ページ `/onboarding/getting-started` のチェックリスト | ◎ 段階感を出せる、再訪可能 |
| `/schedule` 上部の埋め込みカード（データが空のときだけ表示） | ◎ 既存導線に近い、別ページ遷移なし |
| モーダルウィザード（強制ステップ） | × 中断不可 = 押し付けがましい |

**Orchestrator の見解**: 「専用ページ + 業務画面の埋め込みカード」のハイブリッド推奨（`/onboarding/getting-started` を初回表示、以降はホームの埋め込みカードからアクセス可能）。

### 4.4 組織未所属判定の置き場所

| 案 | メリット | デメリット |
|----|----------|-----------|
| middleware で判定 | 早期リダイレクトで API コール削減 | Edge Runtime で DB アクセス不可 → JWT に `has_org` フラグを Auth.js callback で注入する必要 |
| サーバーコンポーネントで判定 | DB アクセス自由、実装単純 | ページ単位に重複実装が出やすい |
| 401/403 fallback で判定 | 実装が散らない | 一度 403 を踏むまで誘導されないので UX 劣 |

**Orchestrator の見解**: middleware では認証のみチェックし、`app/page.tsx`（ルート）で `/api/me` を呼んで組織状態に応じて分岐するのが Edge 制約的に素直。Planner が JWT 拡張を選ぶなら middleware 完結も可能だが、JWT 更新タイミング（組織作成直後にトークンを書き換える必要）の複雑さに注意。

---

## 5. リスクと注意点

### 5.1 既存 E2E バイパスとの整合（最重要）

`backend/backend/auth.py:_get_or_create_e2e_user` は `BYPASS_AUTH_FOR_E2E=1` + `APP_ENV in {test, development}` のときに固定の User / Organization / OrganizationMember を upsert している。本フェーズの新 API（`POST /api/organizations`）が「同一ユーザーが既に owner Member を持つ場合は 409」のような重複防止を入れた場合、E2E バイパスユーザーが組織を作ろうとして失敗するリスクがある。

**対応**:
- Worker A が組織作成 API を実装する際、E2E バイパス用組織がすでに存在するケースを許容する（onboarding を skip して `/schedule` に直接行ける）
- E2E テストの onboarding 経路は「バイパスを **無効化**して通常ログインで通す」専用 spec として書く（既存 3 件の E2E は引き続きバイパス利用）

### 5.2 テナント分離テストへの影響

Phase 0 で追加されたテナント分離テスト 15 件は「ユーザーが既に組織所属している」前提で書かれている。新 API は「組織未所属ユーザーが叩ける唯一の業務系 API」となるので、特殊扱いをテストに追加する必要がある:
- `POST /api/organizations` は `get_current_user` のみ依存し、`get_current_org_id` には依存しない
- 他のすべての業務 API は引き続き 403（変更なし）であることを境界テストで担保

### 5.3 マイグレーション影響

Phase 0-2 で `_run_migrations` が「Default Organization」を作って既存業務テーブル行に `organization_id` を埋めている。Phase 1-7 で Alembic に移行済み。本フェーズでは **新規スキーマ追加なし**を想定（既存 `Organization` / `OrganizationMember` テーブルをそのまま使う）。`organizations.deleted_at` も既存。

万一スキーマ追加が必要になった場合（例: `users.has_seen_onboarding` フラグ）は Alembic で新規マイグレーションを生成する。Planner はスキーマ追加を避ける設計を優先すること。

### 5.4 JWT クレーム拡張のリスク

JWT に `current_organization_id` や `has_org` を載せる方針を Planner が選ぶ場合、以下に注意:
- 組織作成直後にトークンを再発行する仕組みが必要（Auth.js の `unstable_update` か再ログイン誘導）
- バックエンド `get_current_org_id` は引き続き DB の `OrganizationMember` を真実とする（クレームはあくまで早期判定用ヒント）。クレームと DB が乖離した場合は DB を信じる
- TTL 30 日の JWT 内クレームを過信しないこと

### 5.5 セッション・Cookie ドメイン

Phase 0-4 でドメイン取得後に `__Secure-` プレフィックスへ切替予定。本フェーズの実装はそれを前提とせず、`AUTH_COOKIE_NAME` 環境変数で切り替え可能な現状の仕組みを踏襲すれば OK。

### 5.6 i18n / 表記ゆれ

オンボーディング文言は「シフトすけっと」のサービス名に統一（既存 `app/(auth)/signin/page.tsx` のメタタイトルに準拠）。「組織」「店舗」「ワークスペース」のどれを表記に使うかは Designer がガイドライン化する。

### 5.7 Phase 1-2 SMTP との相互作用

オンボーディング画面到達時点で magic link は届いている前提だが、Phase 1-2（Resend）未完了の現状は Mailpit のみ。本フェーズの作業中に Resend 切替が走った場合、E2E が壊れないことを Tester が確認する必要あり。

---

## 6. Definition of Done（フェーズ全体）

- [ ] M3 ブロッカー解消: 新規ユーザーが組織自動付与を経由せず、自力で組織を作って業務 API を叩ける
- [ ] 組織未所属ユーザーが `/schedule` 等にアクセスしようとした場合 `/onboarding` へ誘導される
- [ ] 既存組織所属済みユーザーは UX 変化なし
- [ ] バックエンドテスト 126 → 130+ 件、フロントエンドテスト 75 → 80+ 件、E2E 3 → 4 件（onboarding spec 追加）
- [ ] テナント分離テストはすべて PASS（新 API 含めて越境なし）
- [ ] `STATUS.md` 更新済み（M3 ✅ 反映、Phase 1-1 完了マーク、最終更新日）
- [ ] `docs/usage-guide.md` に「初めて使う方へ」追加
- [ ] Reviewer の Critical 指摘 0 件
