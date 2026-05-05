# Phase 1-1 オンボーディング 技術設計

> 作成日: 2026-05-05
> 対象: Phase 1-1 オンボーディング（運用計画 10h 想定）
> 担当: Planner
> 前提:
> - Phase 0-1 認証 (Auth.js v5 + JWE) 完了
> - Phase 0-2 マルチテナント (`organization_id` 付与・テナント分離) 完了
> - 残ブロッカー [#M3]「新規ユーザーの組織自動付与」を本フェーズで解消する
>
> 参照ドキュメント:
> - `docs/plans/2026-05-05-phase1-1-onboarding-decomposition.md`（Orchestrator のタスク分解）
> - `docs/plans/2026-04-28-operation-plan.md`（運用計画 / Phase 1-1 位置づけ）
> - `docs/plans/2026-04-30-phase0-1-auth-design.md`（§7.3 で「初回サインインで個人組織自動作成」と仮置き）
> - `STATUS.md`（M3 ブロッカー記載）
> - 既存コード: `backend/backend/auth.py`, `backend/backend/api/internal_auth.py`, `backend/backend/models.py`, `backend/backend/main.py`, `frontend/middleware.ts`, `frontend/lib/api.ts`, `frontend/app/page.tsx`, `frontend/app/layout.tsx`, `frontend/components/auth/user-nav.tsx`, `frontend/auth.ts`, `backend/alembic/`

---

## 1. 意思決定サマリ

各決定の根拠を 1 行で添える。詳細は §3 以降を参照。

| # | 論点 | 決定 | 根拠 |
|---|------|------|------|
| 1 | 個人組織の自動作成 vs 明示オンボーディング | **B 案: 明示オンボーディング画面を追加する** | 店舗管理 SaaS として「店舗名」入力が UX 的に自然、Phase 1-8 退会と整合 |
| 2 | slug 自動生成方針 | **サーバー側で UUIDv4 短縮（先頭 12 文字）を自動生成、URL 非露出。ユーザーには見せない** | 日本語名対応コスト削減、サブドメインテナンシー導入時に slug 編集 UI を後付け |
| 3 | 初期データガイド UI | **専用ページ `/onboarding/getting-started`（チェックリスト） + `/schedule` 上の埋め込みカード（データが空のとき）のハイブリッド** | 段階感を出しつつ再訪可・押し付けがましくない |
| 4 | 組織未所属判定の置き場所 | **サーバーコンポーネント (`app/page.tsx`) で `/api/me` を呼び判定。middleware は認証のみチェック。JWT 拡張はしない** | Edge Runtime で DB アクセス不可、JWT 更新タイミングの複雑さを回避 |
| 5 | `POST /api/organizations` の認可仕様 | **認証必須 (`Depends(get_current_user)`)、所有 (role=owner) 組織は 1 ユーザー 1 個まで（既に owner Member を持つ場合は 409）。E2E バイパスユーザーは既に組織を持つため 409 となるが、フロントは 409 を「既に存在」として扱い `/onboarding/getting-started` へ遷移する** | DoS 抑止 + E2E バイパスとの整合 |
| 6 | `GET /api/me` のレスポンス設計 | **単一エンドポイントで `user`, `organizations[]`, `current_organization`, `onboarding` を返す統合レスポンス** | フロント側のラウンドトリップ削減、状態判定が 1 回で済む |
| 7 | エラーレスポンス | **401 (未認証) / 403 (組織未所属で業務 API を叩いた場合のみ) / 409 (slug 衝突 or 既に owner 組織所有) / 422 (バリデーション失敗、Pydantic 既定)** | FastAPI 既定挙動に準拠 |
| 8 | `_get_or_create_e2e_user` を本フェーズで触るか | **触らない。E2E バイパスユーザーは既に組織所属しているので `/onboarding` を経由せず `/schedule` に直行できる（フロント側 `app/page.tsx` で分岐）** | リスク 5.1 の影響範囲を最小化、既存 E2E 3 件の挙動を維持 |
| 9 | マイグレーション必要性 | **新規スキーマ追加なし。`users.has_seen_onboarding` フラグも追加しない（OrganizationMember の有無で代替）** | リスク 5.3 推奨方針に従う、Alembic 新規マイグレーションを生成せず工数圧縮 |
| 10 | Phase 0-1 設計書 §7.3 の扱い | **本設計書（=本 PR スコープ外、Documenter フェーズ Task 4.2）で修正する旨を明記。Planner は本書で「§7.3 は Deprecated」と宣言し、Documenter が 0-1 設計書に追記する** | 設計責務の単一化、Worker は本書だけ見れば良い |

---

## 2. アーキテクチャ概要

### 2.1 シーケンス（Magic Link 経由の新規サインイン）

```
User       Next.js (Auth.js)     FastAPI                DB
 │              │                   │                    │
 │── /signin ──>│                   │                    │
 │── email ───>│                   │                    │
 │              │── POST /api/internal/auth/             │
 │              │       verification-tokens ──>          │
 │              │                   │── INSERT vtoken ──>│
 │              │   (Mailpit へ送信)                     │
 │<──────── magic link メール ─────────────────────────  │
 │── click link >│                  │                    │
 │              │── POST /api/internal/auth/             │
 │              │       verification-tokens/use ──>      │
 │              │                   │── upsert User ────>│
 │              │ (JWE Cookie 発行)                      │
 │<── Set-Cookie authjs.session-token (JWE)              │
 │              │                   │                    │
 │── GET / ────>│                   │                    │
 │   (app/page.tsx = サーバーコンポーネント)              │
 │              │── GET /api/me ───>│                    │
 │              │                   │── SELECT User +    │
 │              │                   │   OrganizationMember
 │              │                   │   JOIN Organization │
 │              │                   │   (deleted_at IS NULL)
 │              │<── { user, organizations: [], onboarding: {...} }
 │              │                   │                    │
 │  organizations.length === 0 ⇒ redirect("/onboarding") │
 │              │                   │                    │
 │── /onboarding ──>│ (組織作成フォーム表示)              │
 │── POST org ──>│                   │                    │
 │              │── POST /api/organizations ──>           │
 │              │   (Cookie で認証 / get_current_user 経由)
 │              │                   │── BEGIN TX         │
 │              │                   │   INSERT Organization
 │              │                   │   INSERT OrganizationMember(role=owner)
 │              │                   │   COMMIT TX ──────>│
 │              │<── 201 { id, name, slug }              │
 │              │                   │                    │
 │              │── GET /api/me ───>│ (ガイド判定再取得)  │
 │              │<── { ..., organizations: [new], onboarding: {staff_count: 0, ...} }
 │── /onboarding/getting-started ─>│ (チェックリスト)    │
 │              │                   │                    │
 │  (任意で /settings 等で初期データ投入)                  │
 │              │                   │                    │
 │── /schedule ──>│                  │                    │
 │              │── GET /api/schedules ──>               │
 │              │ (get_current_org_id が DB から最新を取得)
 │              │<── 200 OK                              │
```

### 2.2 主要コンポーネントと責務境界

| コンポーネント | 責務 | 備考 |
|----------------|------|------|
| `frontend/middleware.ts` | 認証チェックのみ。組織所属判定はしない | E2E バイパスは既存維持 |
| `frontend/app/page.tsx` | サーバーコンポーネントで `/api/me` を呼び、組織所属の有無で `/onboarding` か `/schedule` に分岐 | 唯一の状態分岐ハブ |
| `frontend/app/(onboarding)/onboarding/page.tsx` | 組織作成フォーム | Designer / Worker B 担当 |
| `frontend/app/(onboarding)/onboarding/getting-started/page.tsx` | 初期データチェックリスト | Designer / Worker B 担当 |
| `frontend/app/layout.tsx` / `components/auth/user-nav.tsx` | 3 状態 (未ログイン / 組織なし / 組織あり) でナビ切替 | Worker C 担当 |
| `backend/backend/api/organizations.py` (新規) | `POST /api/organizations`, `GET /api/organizations/me` | Worker A 担当 |
| `backend/backend/api/me.py` (新規) | `GET /api/me` | Worker A 担当 |
| `backend/backend/auth.py` の `get_current_user` / `get_current_org_id` | 既存維持 | 変更なし |
| `_get_or_create_e2e_user` | 既存維持 | §6 参照 |

---

## 3. DB 設計

### 3.1 結論: スキーマ変更なし

既存の `users`, `organizations`, `organization_members` テーブルをそのまま使用する。Alembic マイグレーションは追加しない。

理由:
- 「組織未所属」状態は `OrganizationMember` レコードの不在で十分判定できる
- 「初期データガイド表示済み」フラグ（`users.has_seen_onboarding` 等）は不要 — 「スタッフ 0 人 + シフト枠 0 件」状態を毎回計算する方が UX 的にも実装的にも単純（一度作ったスタッフを全削除した場合に再表示される動作も自然）

### 3.2 既存スキーマの利用範囲（参考）

| テーブル | 用途 | 制約 |
|----------|------|------|
| `users` | 認証ユーザー | `id` (UUID), `email` UNIQUE, `deleted_at IS NULL` |
| `organizations` | 組織 | `id` (UUID), `slug` UNIQUE, `deleted_at IS NULL` |
| `organization_members` | 所属関係 | `(user_id, organization_id)` UNIQUE, `role` ('owner'/'admin'/'member') |
| `staff` / `shift_slots` | onboarding 完了判定用カウント源 | `organization_id` でフィルタ |

### 3.3 将来追加余地（本フェーズではやらない）

- `organizations.created_by_user_id`（owner 1 人制約を将来緩めた場合の作成者追跡） — 今回は `OrganizationMember(role='owner')` で代替
- `users.last_onboarded_at`（初期データガイドの再表示を抑止したい場合） — 必要になった時点で追加

---

## 4. API 設計

### 4.1 共通方針

- 認証エンドポイント全体で Cookie ベース JWE 認証（既存 `get_current_user` Dependency を使用）
- レスポンスは Pydantic スキーマで型安全に返す（`backend/backend/schemas.py` を拡張）
- すべての datetime は naive UTC（既存 `_utcnow` ヘルパー方針に合わせる）
- エラーは `HTTPException` で `detail` 文字列を返す（FastAPI 既定）

### 4.2 `POST /api/organizations`

**目的**: 認証済みユーザーが「自分の組織」を 1 つ作成する。同時に自分を owner Member として登録する。

**ルーター**: `backend/backend/api/organizations.py`（新規）

**Dependency 構成**:
```
Depends(get_current_user)   # 認証必須
Depends(get_db)
```
※ `get_current_org_id` は **使わない**（組織未所属で叩ける必要があるため）。

**リクエスト** (`OrganizationCreateRequest`):
```python
class OrganizationCreateRequest(BaseModel):
    name: str  # 1..100 chars, strip
    # slug は受け付けない（サーバー自動生成、URL 非露出）
```

バリデーション:
- `name`: 必須、1〜100 文字、前後空白 strip 後に空文字なら 422
- 100 文字超は 422

**レスポンス** (`OrganizationResponse`、既存スキーマ流用):
```json
{
  "id": "8b3e...",
  "name": "シフトすけっと食堂 渋谷店",
  "slug": "8b3ef9a7c12d",
  "created_at": "2026-05-05T10:00:00",
  "updated_at": "2026-05-05T10:00:00",
  "deleted_at": null
}
```

**ステータスコード**:
| コード | 状況 |
|--------|------|
| 201 | 作成成功 |
| 401 | 未認証（Cookie なし／JWE 不正／ユーザー削除済み） |
| 409 | (a) slug 衝突（リトライ後も衝突した場合）/ (b) 同一ユーザーが既に owner 組織を所有している |
| 422 | name バリデーション失敗 |

**409 の詳細メッセージ**:
- `"You already own an organization"` (既に owner 組織所有)
- `"Organization slug conflict, please retry"` (slug 衝突 — 通常は内部リトライで吸収するが、最終的に発生した場合のみ)

**slug 自動生成ロジック**:
- `uuid.uuid4().hex[:12]` を生成 → DB に同 slug が存在しないか確認
- 衝突した場合は最大 5 回リトライ
- 5 回連続衝突は宇宙の終わりなので 409 を返す（運用上は発生しない）

**トランザクション**:
- `Organization` INSERT と `OrganizationMember(role='owner')` INSERT を **同一トランザクション**で実行
- 失敗時は ROLLBACK し 5xx ではなく 409 か 500 を返す
- SQLAlchemy `IntegrityError` を捕捉して slug 衝突をリトライ

**owner 組織重複チェック**:
- `POST` 受信時に `OrganizationMember.user_id == current_user.id AND role == 'owner'` の存在確認
- 1 件以上あれば 409 で即返却（DB 触る前のフェイルファースト）

### 4.3 `GET /api/organizations/me`

**目的**: 自分の所属組織一覧を取得する。

**Dependency 構成**:
```
Depends(get_current_user)
Depends(get_db)
```

**リクエスト**: なし（Cookie のみ）

**レスポンス** (`list[OrganizationMembershipResponse]`):
```python
class OrganizationMembershipResponse(BaseModel):
    organization: OrganizationResponse
    role: str           # "owner" | "admin" | "member"
    joined_at: datetime
```

JSON 例:
```json
[
  {
    "organization": {
      "id": "8b3e...",
      "name": "シフトすけっと食堂 渋谷店",
      "slug": "8b3ef9a7c12d",
      "created_at": "2026-05-05T10:00:00",
      "updated_at": "2026-05-05T10:00:00",
      "deleted_at": null
    },
    "role": "owner",
    "joined_at": "2026-05-05T10:00:00"
  }
]
```

**ステータスコード**: 200（空配列の場合も 200 で `[]` を返す）／401。

**フィルタ条件**: `Organization.deleted_at IS NULL`（論理削除組織は除外、`get_current_org_id` の挙動と整合）

### 4.4 `GET /api/me`

**目的**: ナビゲーション・ルーティング判定に必要な情報を 1 リクエストで返す統合エンドポイント。

**Dependency 構成**:
```
Depends(get_current_user)
Depends(get_db)
```

**リクエスト**: なし

**レスポンス** (`MeResponse`):
```python
class CurrentOrganizationSummary(BaseModel):
    id: str
    name: str
    slug: str
    role: str  # 自分のロール

class OnboardingStateResponse(BaseModel):
    """初期データガイド表示判定用カウント。current_organization が None のときは null を返す。"""
    staff_count: int
    shift_slot_count: int
    is_complete: bool   # staff_count > 0 AND shift_slot_count > 0

class MeResponse(BaseModel):
    user: UserResponse
    organizations: list[OrganizationMembershipResponse]
    current_organization: CurrentOrganizationSummary | None
    onboarding: OnboardingStateResponse | None
```

JSON 例 (組織なしの新規ユーザー):
```json
{
  "user": {
    "id": "u-abc",
    "email": "owner@example.com",
    "email_verified_at": "2026-05-05T09:00:00",
    "name": null,
    "image": null,
    "created_at": "2026-05-05T09:00:00",
    "updated_at": "2026-05-05T09:00:00",
    "deleted_at": null
  },
  "organizations": [],
  "current_organization": null,
  "onboarding": null
}
```

JSON 例 (組織あり・初期データ未投入):
```json
{
  "user": { "...": "..." },
  "organizations": [
    { "organization": {"id": "8b3e...", "name": "...", "slug": "..."}, "role": "owner", "joined_at": "..." }
  ],
  "current_organization": {
    "id": "8b3e...",
    "name": "シフトすけっと食堂 渋谷店",
    "slug": "8b3ef9a7c12d",
    "role": "owner"
  },
  "onboarding": {
    "staff_count": 0,
    "shift_slot_count": 0,
    "is_complete": false
  }
}
```

**`current_organization` の決定ロジック**:
- `get_current_org_id` と整合: `OrganizationMember` を `Organization.deleted_at IS NULL` で JOIN し、最初の 1 件を選ぶ（複数組織所属時の選択ロジックは Phase 0 完了レビュー [#m2] で将来対応）
- 組織が 0 件のときは `null`

**`onboarding` の計算**:
- `current_organization` が `None` のときは `null`
- そうでなければ:
  - `staff_count`: `SELECT COUNT(*) FROM staff WHERE organization_id = :current_org_id`
  - `shift_slot_count`: `SELECT COUNT(*) FROM shift_slots WHERE organization_id = :current_org_id`
  - `is_complete`: `staff_count > 0 AND shift_slot_count > 0`
- 既存 `StaffRepository` / repository に COUNT メソッドがなければ Worker A が追加（リポジトリの責務分離）

**ステータスコード**: 200 / 401。

**キャッシュヘッダ**: `Cache-Control: no-store`（状態が頻繁に変わるため、ブラウザ・CDN キャッシュ禁止）。

### 4.5 既存 32 エンドポイントへの影響

**変更なし**。`POST /api/organizations` だけが `get_current_user` のみ依存し、それ以外は引き続き `get_current_org_id` 依存（=組織未所属で 403）。

### 4.6 ルーター登録

`backend/backend/main.py` に追加:
```python
from backend.api.me import router as me_router
from backend.api.organizations import router as organizations_router
...
app.include_router(organizations_router)
app.include_router(me_router)
```

### 4.7 Pydantic スキーマ拡張（`backend/backend/schemas.py`）

追加するクラス:

```python
# §4.2
class OrganizationCreateRequest(BaseModel):
    name: str  # validators で 1..100 + strip

# §4.3
class OrganizationMembershipResponse(BaseModel):
    organization: OrganizationResponse
    role: str
    joined_at: datetime
    model_config = {"from_attributes": True}

# §4.4
class CurrentOrganizationSummary(BaseModel):
    id: str
    name: str
    slug: str
    role: str

class OnboardingStateResponse(BaseModel):
    staff_count: int
    shift_slot_count: int
    is_complete: bool

class MeResponse(BaseModel):
    user: UserResponse
    organizations: list[OrganizationMembershipResponse]
    current_organization: CurrentOrganizationSummary | None
    onboarding: OnboardingStateResponse | None
```

注: 既存 `OrganizationCreate` (`id`, `name`, `slug` 受信) は内部認証 API 用に残し、新 API は `OrganizationCreateRequest` を使う（責務分離）。

---

## 5. フロントエンド技術設計

### 5.1 ルーティング構造

採用: **`(onboarding)` ルートグループを新規作成**（既存 `(auth)` と同じ流儀）。

```
frontend/app/
├── (auth)/                       # 既存（layout でナビ非表示）
│   ├── layout.tsx
│   ├── signin/page.tsx
│   ├── verify-request/page.tsx
│   └── auth/error/page.tsx
├── (onboarding)/                 # 新規
│   ├── layout.tsx                # ナビ非表示（(auth) と同等）
│   └── onboarding/
│       ├── page.tsx              # 組織作成フォーム
│       └── getting-started/
│           └── page.tsx          # 初期データチェックリスト
├── layout.tsx                    # ルートレイアウト（既存）
├── page.tsx                      # 状態分岐ハブ（改修）
├── schedule/page.tsx             # 既存
├── settings/page.tsx             # 既存
├── staff/page.tsx                # 既存
└── view/page.tsx                 # 既存
```

`(onboarding)/layout.tsx` は `(auth)/layout.tsx` と同じく中央寄せのみ（ヘッダーナビは継承させない）。

### 5.2 middleware 改修方針

**結論: middleware は認証チェックのみで据え置き、組織所属判定は入れない**。

理由:
- middleware は Edge Runtime のため DB アクセス不可、`/api/me` を呼ぶには Cookie 転送 + バックエンドへの HTTP 往復が発生し、本フェーズの工数バジェット (10h) を圧迫
- JWT に `has_org` フラグを注入する案は組織作成直後にトークン更新が必要になり複雑化（Phase 0-1 §7.3 想定外の追加コスト）
- `app/page.tsx`（サーバーコンポーネント）で `/api/me` を呼ぶ方が Edge 制約に素直

**改修内容**: `/onboarding` パスを認証ページと同じ「未ログインリダイレクト対象」とし、認証済みユーザーには通過させる。組織所属の有無での挙動分岐は middleware ではなく `app/page.tsx` と各ページのサーバーコンポーネントが担当する。

具体的には現行 `frontend/middleware.ts` の `isAuthPage` 判定で `/onboarding` プレフィックスを **追加しない**。`/onboarding` は「認証済み・組織未所属」のためのページなので、未認証アクセスは従来通り `/signin` に飛ばす。

```ts
// 現行コードに追加変更なし（/onboarding も「保護ルート」扱いで OK）
const isAuthPage =
  pathname.startsWith("/signin") ||
  pathname.startsWith("/verify-request") ||
  pathname.startsWith("/auth/error");
```

### 5.3 `app/page.tsx` の状態分岐実装

**現行**: クライアントコンポーネントの `redirect("/schedule")` 一律。

**改修後**: サーバーコンポーネントで `/api/me` を呼び、3 分岐:

```typescript
// frontend/app/page.tsx (サーバーコンポーネント)
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchMeServer } from "@/lib/api-server";  // 新規

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/signin");

  const me = await fetchMeServer();           // Cookie をサーバー側で転送する fetch
  if (me.organizations.length === 0) {
    redirect("/onboarding");
  }
  // 初期データ未投入なら getting-started を優先表示する案もあるが、
  // ユーザーが /schedule を踏みたいケースもあるので埋め込みカード派にする（§5.5）
  redirect("/schedule");
}
```

`fetchMeServer` は `next/headers` の `cookies()` を読んで FastAPI に Cookie を転送する**サーバー専用ヘルパー**。`frontend/lib/api-server.ts` として新規追加（`lib/api.ts` のクライアント版とは責務分離）。Worker C が実装。

### 5.4 `/api/me` キャッシュ戦略

採用: **サーバー取得（fetch with `cache: 'no-store'`）+ クライアント側は直接呼ばない**。

理由:
- フロント側で SWR/React Query は本プロジェクトでは未採用（既存 `lib/api.ts` は素の fetch）
- `/api/me` の結果は組織作成直後やデータ投入直後に変わるため、キャッシュは混乱の元
- ナビゲーション切替のためにクライアント側で取得する場合は、**コンポーネント単位で Server Component から props で渡す**（クライアント取得しない）

クライアント側で再取得が必要なケース（組織作成完了後の `/onboarding/getting-started` 遷移）:
- ページ遷移自体が完全なナビゲーションになるため、Next.js のサーバーコンポーネントが再評価される（クライアント側キャッシュ不要）

例外: `UserNav` 等のクライアント Component から組織情報を参照したい場合は、ルートレイアウトで `/api/me` をサーバーで取得し、Context 経由で配信する（Worker C 担当、§5.5）。

### 5.5 ナビゲーション 3 状態（`app/layout.tsx` + `UserNav`）

3 状態の表示要件:

| 状態 | ヘッダーナビ | UserNav |
|------|--------------|---------|
| A. 未ログイン | 非表示（`(auth)` / `(onboarding)` グループ既定で非表示、保護ルートには到達不能） | ログインボタン（既存） |
| B. ログイン済み・組織未所属 | 非表示（`(onboarding)` グループは独自レイアウトでナビ非表示） | アバター + ログアウトのみ（組織情報なし） |
| C. ログイン済み・組織所属あり | 全リンク表示 | アバター + 組織名 + ログアウト |

**実装方針**:
- `app/layout.tsx`（ルート）はヘッダー DOM を維持するが、ヘッダー内のナビリンク群を **新コンポーネント `<MainNav />`（Server Component）** に切り出し、`fetchMeServer()` の結果に応じて条件レンダリング
- `(onboarding)/layout.tsx` と `(auth)/layout.tsx` は既存どおりルートレイアウトのヘッダー DOM を継承するが、各ページが「ナビ非表示モード」フラグを props で渡す方式は採らない（Next.js の Layout 階層では下位レイアウトが上位ヘッダーを除去できないため）

→ シンプル化のため、ルートレイアウトでは「組織所属あり」の判定を行い、未所属時はヘッダーナビをレンダリングしない（ヘッダーバー自体は表示し、ロゴ + UserNav のみとする）。

擬似コード:
```typescript
// frontend/app/layout.tsx (Server Component に変換)
export default async function RootLayout({ children }) {
  const session = await auth();
  const me = session ? await fetchMeServer() : null;
  const hasOrg = (me?.organizations.length ?? 0) > 0;
  return (
    <html>
      <body>
        <SessionProvider>
          <header>
            <Logo />
            {hasOrg && <MainNav />}        {/* リンク 4 つ */}
            <UserNav orgName={me?.current_organization?.name} />
          </header>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

`UserNav` は引き続きクライアントコンポーネントとし、`orgName` プロップを受け取って表示に使う（既存 `useSession` の `loading` ハンドリングは維持）。

### 5.6 オンボーディング画面の役割（Worker B 向け仕様）

**`/onboarding/page.tsx`**:
- フォーム要素: `name`（組織名）入力欄 + 送信ボタンのみ。slug は表示しない・編集させない
- `createOrganization({ name })` を `lib/api.ts` 経由で呼び出し
- 成功 (201) → `router.push("/onboarding/getting-started")`
- 409 (`"You already own an organization"`) → `router.push("/onboarding/getting-started")`（既存組織あり。フロー再進入とみなす）
- 409 (`"Organization slug conflict, please retry"`) → エラー表示「もう一度お試しください」
- 422 → フォームバリデーションメッセージ表示
- UI 詳細（shadcn/ui コンポーネント、配色、文言）は Designer 責務

**`/onboarding/getting-started/page.tsx`**:
- サーバーコンポーネントで `fetchMeServer()` を呼ぶ
- `me.onboarding` の `staff_count` / `shift_slot_count` に基づきチェック状態を決定
- ステップ:
  1. スタッフ登録 (`/settings` にリンク) — `staff_count > 0` でチェック
  2. シフト枠登録 (`/settings` にリンク) — `shift_slot_count > 0` でチェック
  3. 必要人数設定 (`/settings` にリンク) — Phase 1-1 ではこのステップのチェックロジックは省略可（Designer が UI 上「任意」表示するなど判断）
  4. 最適化実行 (`/schedule` にリンク) — チェックロジックなし（ユーザーが踏んだら遷移するだけ）
- `is_complete === true` のとき「完了！シフト表へ」CTA を強調表示

**`/schedule` 上の埋め込みカード**:
- `/schedule/page.tsx` は既存どおり。ただし最上部に `<OnboardingHintCard />`（新規）を Server Component で配置
- `me.onboarding.is_complete === false` のときのみ表示
- 表示内容は Designer に委ねる（チェックリストへの導線リンクのみあれば最低条件 OK）

### 5.7 `lib/api.ts` への追加（クライアント側）

```typescript
// frontend/lib/api.ts に追加
export async function createOrganization(data: { name: string }): Promise<OrganizationResponse> {
  return apiFetch<OrganizationResponse>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me");
}

export async function fetchMyOrganizations(): Promise<OrganizationMembershipResponse[]> {
  return apiFetch<OrganizationMembershipResponse[]>("/api/organizations/me");
}
```

`apiFetch` の 401 自動リダイレクトはオンボーディングページで望ましくない場合がある（既にサインイン済みなのに 401 が返る = サーバー設定ミス）→ 既存挙動のままでよい（401 は本当にサインアウト相当の事象だけなので /signin への戻りで OK）。

### 5.8 サーバー側 fetch ヘルパー（新規）

```typescript
// frontend/lib/api-server.ts (新規、Server Component 専用)
import { cookies } from "next/headers";
import type { MeResponse } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchMeServer(): Promise<MeResponse | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

注意:
- `cookies()` は Next.js 15 では `await` 必須（既存コードベースが Next.js 15 を使っているか Worker C が確認のうえ、必要に応じて型を合わせる）
- 本ヘルパーはクライアントコンポーネントから呼び出し禁止（`"use server"` 不要・ただし Server Component / Server Action 限定）

### 5.9 TypeScript 型定義（`lib/types.ts` 拡張）

```typescript
// frontend/lib/types.ts に追加
export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationMembershipResponse {
  organization: OrganizationResponse;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface CurrentOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
}

export interface OnboardingStateResponse {
  staff_count: number;
  shift_slot_count: number;
  is_complete: boolean;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    email_verified_at: string | null;
    name: string | null;
    image: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  organizations: OrganizationMembershipResponse[];
  current_organization: CurrentOrganizationSummary | null;
  onboarding: OnboardingStateResponse | null;
}
```

---

## 6. `_get_or_create_e2e_user` への影響と対処

**結論: 触らない**。

`backend/backend/auth.py:_get_or_create_e2e_user` は `BYPASS_AUTH_FOR_E2E=1` + `APP_ENV in {test, development}` のときに固定 User / Organization / OrganizationMember(role=owner) を upsert する。本フェーズの `POST /api/organizations` は「既に owner Member を持つ場合は 409」で重複防止するため、E2E バイパスユーザーは 409 を踏む。

**対処方針**:
1. **E2E バイパスユーザーは `/onboarding` を経由しない**: `app/page.tsx` のサーバーコンポーネントで `me.organizations.length > 0` を確認するため、E2E バイパスユーザーは即 `/schedule` に飛ぶ。`/onboarding` には到達しない
2. **既存 E2E テスト 3 件はバイパス継続**: 認証バイパスユーザーが組織を持っている前提のテストは無改修で PASS する
3. **新規 E2E (`onboarding.spec.ts`) はバイパスを無効化**: `E2E_DISABLE_AUTH=0`（または環境変数を設定しない）+ Mailpit から magic link 取得経路を踏む。Tester が専用 spec として書く
4. **保険として、`POST /api/organizations` は 409 メッセージで「既に所有」「slug 衝突」を区別する**: フロント側で「既に所有」の場合は `/onboarding/getting-started` に進ませることで、万一 E2E バイパスユーザーが `/onboarding` を踏んでもクラッシュしない

**`_get_or_create_e2e_user` を変更する誘惑への抑制**: 本フェーズで「E2E バイパスユーザーには organization を作らない」と変更すると、既存 E2E 3 件と Phase 0-2 のテナント分離テストが全部壊れる。リスクが大きいため変更しない。

---

## 7. テスト方針

### 7.1 Worker / Tester 向け追加テストファイル

| 担当 | ファイル | 内容 |
|------|---------|------|
| Worker A (BE 単体) | `backend/tests/test_api_organizations.py` | `POST /api/organizations`: 201 / 401 / 409(既所有) / 409(slug衝突モック) / 422、`Organization` と `OrganizationMember(role=owner)` が同一 TX で作成されることを検証 |
| Worker A (BE 単体) | `backend/tests/test_api_organizations.py`（同上） | `GET /api/organizations/me`: 200 with [] / 200 with 1件 / 401 / 論理削除組織が除外されること |
| Worker A (BE 単体) | `backend/tests/test_api_me.py` | `GET /api/me`: 401 / 組織なしユーザー (organizations=[], current_organization=null, onboarding=null) / 組織あり + データ未投入 (onboarding.is_complete=false) / 組織あり + データ投入済 (is_complete=true) |
| Worker B (FE 単体) | `frontend/components/onboarding/__tests__/create-org-form.test.tsx` | フォーム送信成功 → router.push が呼ばれる / 422 でエラー表示 / 409 既所有で getting-started に遷移 |
| Worker B (FE 単体) | `frontend/components/onboarding/__tests__/getting-started-checklist.test.tsx` | 各カウントに応じたチェック状態の表示 |
| Worker C (FE 単体) | `frontend/__tests__/middleware.test.ts`（既存拡張 / 新規） | `/onboarding` に未認証アクセスで `/signin` リダイレクト / 認証済みなら通過 |
| Worker C (FE 単体) | `frontend/app/__tests__/page.test.tsx` | 未認証で /signin / 組織なしで /onboarding / 組織ありで /schedule（fetchMeServer をモック） |
| Tester (統合) | `backend/tests/test_onboarding_flow.py` | フロー全体: 新規ユーザー作成 → /api/me で空 → POST /api/organizations → /api/me で 1件 → /api/staff が 200 を返す |
| Tester (統合) | `backend/tests/test_tenant_isolation_onboarding.py` | 組織 A の owner が `POST /api/organizations` を叩いて B を作ろうとしたら 409（owner 重複）。組織 A のユーザーが B のリソースを叩けないことの再確認 |
| Tester (E2E) | `frontend/e2e/onboarding.spec.ts` | バイパス無効化 + Mailpit 連携: signin → magic link → /onboarding → 組織作成 → /onboarding/getting-started → スタッフ作成でチェック点灯 → /schedule 到達 |

### 7.2 既存テスト破壊の有無

| 既存テスト | 影響 | 対応 |
|-----------|------|------|
| backend 126 件 | なし（既存 32 エンドポイントは引き続き `get_current_org_id` 依存） | フィクスチャのまま |
| frontend 75 件 | `app/page.tsx` がサーバーコンポーネント化 → 既存の `app/page.test.tsx` 等あれば書換 | Worker C が確認 |
| E2E 3 件 | バイパスユーザーは組織所属しているため `/onboarding` を経由しない（無影響を期待） | Tester が PASS 確認 |

### 7.3 工数見積 (Tester 担当)

- 統合テスト 2 ファイル: 0.5h
- E2E 1 ファイル + Mailpit 連携: 1.0h
- 合計 1.5h（Orchestrator §6 工数表と一致）

---

## 8. Worker 分割の確定（並列着手のための仕様凍結）

Orchestrator §2 のタスク 2.1 / 2.2 / 2.3 に対応する仕様スケルトンを以下に確定する。**Worker A はこの章だけ読めば実装可能**、**Worker B / C は §4 と §5 と本章を読めば実装可能**。

### 8.1 Worker A（BE）の納品物スケルトン

`backend/backend/api/organizations.py`:
```python
"""組織作成・所属組織取得 API（Phase 1-1 オンボーディング）。

ユーザーが「自分の組織」を 1 つ作成するためのエンドポイント。
get_current_user のみに依存し、get_current_org_id には依存しない（組織未所属で叩ける必要があるため）。
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Organization, OrganizationMember, User
from backend.schemas import (
    OrganizationCreateRequest,
    OrganizationMembershipResponse,
    OrganizationResponse,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    data: OrganizationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    """新規組織を作成し、呼び出しユーザーを owner Member として登録する。

    - 既に owner 組織を持つユーザーは 409
    - slug は UUID v4 hex の先頭 12 文字を使い、衝突時は最大 5 回リトライ
    - Organization と OrganizationMember は同一トランザクション内で作成
    """
    ...  # 実装は Worker A


@router.get(
    "/me",
    response_model=list[OrganizationMembershipResponse],
)
def list_my_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """自分の所属組織一覧を返す。論理削除組織は除外する。"""
    ...  # 実装は Worker A
```

`backend/backend/api/me.py`:
```python
"""GET /api/me — 認証ユーザー情報 + 所属組織 + オンボーディング状態の統合レスポンス。"""
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import User
from backend.schemas import MeResponse

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("", response_model=MeResponse)
def get_me(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    """ナビゲーション・ルーティング判定用の統合レスポンス。

    - organizations: 論理削除組織を除外
    - current_organization: 最初の所属組織（複数所属時の選択は将来対応）
    - onboarding: current_organization が存在するときのみ staff/shift_slots カウントを返す
    """
    response.headers["Cache-Control"] = "no-store"
    ...  # 実装は Worker A
```

`backend/backend/main.py` のルーター登録（追記行のみ）:
```python
from backend.api.me import router as me_router
from backend.api.organizations import router as organizations_router
...
app.include_router(organizations_router)
app.include_router(me_router)
```

### 8.2 Worker B（FE オンボーディング画面）の納品物スケルトン

ファイル一覧（中身は Designer 仕様 + 本書 §5.6 に従う）:
- `frontend/app/(onboarding)/layout.tsx`（ナビ非表示の中央寄せレイアウト、`(auth)/layout.tsx` を流用）
- `frontend/app/(onboarding)/onboarding/page.tsx`（クライアントコンポーネント — フォーム submit でクライアント側で `createOrganization` を呼ぶ）
- `frontend/app/(onboarding)/onboarding/getting-started/page.tsx`（サーバーコンポーネント — `fetchMeServer()` で状態取得）
- `frontend/components/onboarding/create-org-form.tsx`（フォーム本体、props: `onSuccess: (org) => void`）
- `frontend/components/onboarding/getting-started-checklist.tsx`（受け取った counts を表示）
- `frontend/components/onboarding/onboarding-hint-card.tsx`（`/schedule` 上の埋め込みカード）

### 8.3 Worker C（FE middleware + ナビゲーション）の納品物スケルトン

- `frontend/app/page.tsx` のサーバーコンポーネント化（§5.3）
- `frontend/app/layout.tsx` のサーバーコンポーネント化 + ヘッダーナビ条件レンダリング（§5.5）
- `frontend/components/main-nav.tsx`（新規、ヘッダー用ナビリンク群、props 受けず内部で fetchMeServer 呼ばない＝親から `hasOrg` を受け取る）
- `frontend/components/auth/user-nav.tsx` の微改修（`orgName?: string` props 追加、表示）
- `frontend/lib/api-server.ts`（§5.8）
- `frontend/lib/types.ts`（§5.9 の型追加）
- `frontend/lib/api.ts` のクライアント側ラッパー追加（§5.7）
- `frontend/middleware.ts` は変更なし（§5.2 の判断結果）

### 8.4 並列着手の前提条件

- Worker A は本書受領直後に着手可能（API 仕様確定済み）
- Worker B / C は **API モックが無くても着手可**（型定義 §5.9 と仕様 §4 から MSW などでモックして開発開始）。実 API の到着を待たない
- Worker A が実装完了次第、B / C は Mock を実 API に差し替えて結合確認

---

## 9. オープン課題（後続フェーズへの引き継ぎ）

### 9.1 Designer (Task 1.2) で解決すべき項目

1. `/onboarding` フォームの shadcn/ui コンポーネント選定（Card, Input, Button, Form 等）
2. 「店舗名」のプレースホルダ文言・例示
3. `/onboarding/getting-started` チェックリストのビジュアル表現（ステップインジケーター、完了時のお祝い演出有無）
4. `/schedule` 上の `OnboardingHintCard` の配置位置・dismiss 可能性
5. ヘッダーナビ「組織未所属」状態の見え方（薄いプレースホルダか完全非表示か）
6. UserNav に組織名を表示する場合の文字数 truncate 仕様
7. 「組織」「店舗」「ワークスペース」の表記統一（リスク 5.6 参照、ガイドライン化）

### 9.2 Reviewer (Task 4.1) で確認すべき項目

1. `POST /api/organizations` の認可: 認証必須・自分以外の組織を作れない構造になっているか
2. owner 組織の重複防止が同時並行リクエストでも効くか（race condition、`OrganizationMember` の UNIQUE (`user_id`, `organization_id`) は別組織へは無力）→ 必要なら明示的な「ユーザーごとの owner 組織数」DB クエリ + アプリケーション層チェック + リトライで担保
3. `_get_or_create_e2e_user` を本フェーズが破壊していないか（既存 E2E 3 件 + テナント分離テスト 15 件の挙動確認）
4. `app/page.tsx` での `fetchMeServer()` 失敗時の挙動（FastAPI ダウン → 500 vs サインアウトリダイレクト）
5. `MainNav` の条件レンダリングが SSR / クライアントナビゲーション両方で一貫するか
6. slug を URL 露出させない方針が将来のサブドメインテナンシーで詰まらないか
7. レート制限の必要性: 1 ユーザーが 1 owner 組織しか作れない仕様により大きな DoS は起きないが、「organizations API に対する単純な攻撃」自体は別問題（Phase 1-4 の Sentry / WAF 検討に委ねる）

### 9.3 Documenter (Task 4.2) で対応すべき項目

1. **`docs/plans/2026-04-30-phase0-1-auth-design.md` §7.3 の修正**: 「初回サインインで自動的にデフォルト組織を作成」→「Phase 1-1 で明示オンボーディングに切替済み」と追記。本書をリファレンスとしてリンク
2. `docs/usage-guide.md` に「初めて使う方へ」セクションを新設
3. `docs/technical-guide.md` の「組織モデルと所属判定」セクションに `/api/me` の存在と判定ロジックを追記
4. `STATUS.md` で M3 ✅ 反映、Phase 1-1 完了マーク、テスト件数更新（130+/80+/4）
5. `CHANGELOG.md`（無ければ新規）に Phase 1-1 エントリを追加

### 9.4 将来フェーズへの送り

- 複数組織所属時の組織切替 UI（Phase 0 完了レビュー [#m2]）— `current_organization` 決定ロジックの「最初の 1 件」をユーザー選択に置き換える
- 招待リンクで既存組織に参加するフロー（Phase 1-x 後送り）
- 組織削除（退会）フロー（Phase 1-8）— 最終 owner 退会時の処遇
- RBAC（Phase 0-3）— `OrganizationMember.role` の owner/admin/member 分岐
- サブドメインテナンシー対応時の slug 編集 UI

---

## 10. Definition of Done（本設計書の完了条件）

- [x] 意思決定 1〜10 すべてに結論が記載されている
- [x] §4 で `POST /api/organizations`, `GET /api/organizations/me`, `GET /api/me` のリクエスト・レスポンス・エラー・Dependency が確定
- [x] §5 で middleware・`app/page.tsx`・layout の改修方針が確定
- [x] §6 で E2E バイパスとの整合方針が記載されている
- [x] §7 で Worker / Tester が書くべきテストファイル一覧が提示されている
- [x] §8 で Worker A / B / C が並列着手するための仕様スケルトンが提示されている
- [x] §9 で Designer / Reviewer / Documenter への引き継ぎ事項が列挙されている

以上を満たすため、本書を Designer / Worker A / B / C への発注書として確定する。
