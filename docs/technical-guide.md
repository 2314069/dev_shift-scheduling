# シフトスケジューラー 技術ガイド（初心者向け）

このドキュメントでは、本プロジェクトで使われている技術要素を初心者向けに解説します。

---

## 全体像

```
ブラウザ（ユーザー）
    ↕  HTTP通信
フロントエンド（Next.js / React）  ← 画面の表示を担当
    ↕  REST API（JSON）
バックエンド（FastAPI / Python）   ← データ処理・最適化を担当
    ↕  SQL
データベース（SQLite）             ← データの保存を担当
```

このアプリは**フロントエンド**と**バックエンド**の2つに分かれています。これを「フロントエンド・バックエンド分離構成」と呼びます。

---

## フロントエンド（画面を作る側）

### Next.js とは

Reactベースの**Webアプリケーションフレームワーク**です。

- **React** — UIを「コンポーネント」という部品に分けて作るライブラリ。ボタン、テーブル、カレンダーなどを個別の部品として開発できる
- **Next.js** — Reactに「ページルーティング」「ビルド最適化」「サーバー側レンダリング」などを追加したフレームワーク。Reactだけでは面倒な部分を便利にしてくれる

本プロジェクトでは **App Router** という仕組みを使っています。`app/` フォルダの中のディレクトリ構造がそのままURLになります。

```
app/
├── page.tsx          → http://localhost:3000/
├── settings/page.tsx → http://localhost:3000/settings
├── schedule/page.tsx → http://localhost:3000/schedule
└── staff/page.tsx    → http://localhost:3000/staff
```

### TypeScript とは

JavaScriptに**型（type）**を追加した言語です。

```typescript
// JavaScript — 何でも入る、間違いに気づきにくい
let name = "田中";
name = 123; // エラーにならないが、バグの原因になる

// TypeScript — 型が合わないとエラーになる
let name: string = "田中";
name = 123; // コンパイルエラー！事前にミスを防げる
```

型を定義しておくことで、存在しないプロパティへのアクセスやデータの受け渡しミスを**コードを書いている段階で**検出できます。本プロジェクトでは `lib/types.ts` にAPIで扱うデータの型を定義しています。

### Tailwind CSS とは

CSSの**ユーティリティクラス**を使ってスタイリングするフレームワークです。

```html
<!-- 従来のCSS: 別ファイルにスタイルを書く -->
<div class="card">...</div>
<!-- card { padding: 16px; background: white; border-radius: 8px; } -->

<!-- Tailwind: クラス名で直接スタイルを指定 -->
<div class="p-4 bg-white rounded-lg">...</div>
```

CSSファイルを別途管理する手間が減り、HTML（JSX）を見るだけでデザインがわかります。

### shadcn/ui とは

**コピー&ペースト型のUIコンポーネントライブラリ**です。

一般的なUIライブラリ（Material UIなど）は `npm install` でインストールしますが、shadcn/uiは**ソースコードを自分のプロジェクトにコピー**します。

```
components/ui/
├── button.tsx   ← ボタンコンポーネント
├── table.tsx    ← テーブルコンポーネント
├── dialog.tsx   ← ダイアログ（モーダル）
├── input.tsx    ← テキスト入力
├── select.tsx   ← セレクトボックス
└── card.tsx     ← カード
```

コードが手元にあるため、自由にカスタマイズできるのが利点です。

---

## バックエンド（データ処理をする側）

### FastAPI とは

Pythonの**Web APIフレームワーク**です。ブラウザ（フロントエンド）からのリクエストを受け取り、処理して結果を返します。

```python
@app.get("/api/staff")          # GETリクエストを処理
def list_staff():
    return db.query(Staff).all() # DBからスタッフ一覧を取得して返す

@app.post("/api/staff")         # POSTリクエストを処理
def create_staff(data):
    # 新しいスタッフをDBに保存
```

FastAPIの特徴:
- **高速**: 非同期処理に対応し、パフォーマンスが良い
- **自動ドキュメント**: http://localhost:8000/docs にアクセスすると、APIの仕様書が自動生成される（Swagger UI）
- **型チェック**: Pydanticと連携して入力データのバリデーションを自動で行う

### REST API とは

フロントエンドとバックエンドの**通信ルール**です。HTTPメソッド（GET, POST, PUT, DELETE）とURLの組み合わせで「何をするか」を表現します。

```
GET    /api/staff       → スタッフ一覧を取得する
POST   /api/staff       → 新しいスタッフを登録する
PUT    /api/staff/1     → ID=1のスタッフ情報を更新する
DELETE /api/staff/1     → ID=1のスタッフを削除する
```

データは**JSON**形式でやり取りします。

```json
{
  "name": "田中太郎",
  "role": "リーダー",
  "max_days_per_week": 5
}
```

### SQLAlchemy とは

Pythonの**ORM（Object-Relational Mapper）**です。Pythonのクラスとデータベースのテーブルを対応付け、SQLを直接書かなくてもデータ操作ができます。

```python
# SQLAlchemyを使う場合（Python風に書ける）
staff = db.query(Staff).filter(Staff.name == "田中").first()

# 生SQLの場合（こちらは使わない）
# SELECT * FROM staff WHERE name = '田中' LIMIT 1;
```

本プロジェクトでは `backend/models.py` でテーブル構造を定義しています。

### Pydantic とは

データの**バリデーション（入力チェック）とシリアライズ（変換）**を行うライブラリです。

```python
class StaffCreate(BaseModel):
    name: str                    # 文字列必須
    role: str                    # 文字列必須
    max_days_per_week: int = 5   # 整数、デフォルト5

# nameが抜けていたら自動でエラーを返してくれる
# 数値に文字列が来ても自動でエラーになる
```

FastAPIと組み合わせることで、「不正なリクエストが来たら自動で400エラーを返す」といったことが追加のコード不要で実現できます。

### SQLite とは

**ファイルベースの軽量データベース**です。

```
一般的なDB（PostgreSQL等）:
  → サーバーを別途起動する必要がある
  → セットアップが複雑

SQLite:
  → ファイル1つ（shift_scheduling.db）がDB
  → インストール不要
  → 小〜中規模なら十分な性能
```

開発やMVPに最適で、将来的に利用者が増えた場合はPostgreSQLなどに切り替えることもできます。

---

## 数理最適化（このアプリの核心部分）

### 数理最適化とは

「制約条件を満たしつつ、目的関数を最小化（または最大化）する」問題を数学的に解く手法です。

身近な例でいうと:
- **制約条件** = 守らなければならないルール
- **目的関数** = 最適化したい指標
- **決定変数** = 決めたいこと

### このアプリでの定式化

**決定変数（決めたいこと）:**
```
x[スタッフs, 日付d, シフト枠t] = 0 or 1
  1 → スタッフsを日付dにシフト枠tに割り当てる
  0 → 割り当てない
```

**制約条件（守るべきルール）:**
1. 各スタッフは1日に最大1つのシフト
2. 各シフト枠×日付で最低必要人数を確保
3. 「出勤不可」と登録された日には割り当てない
4. N日以上の連勤を禁止
5. 週あたりの勤務日数上限を守る

**目的関数（最適化したい指標）:**
```
最小化: 総割り当て人数 − 総必要人数
```
→ 必要人数をちょうど満たすような割り当てを目指す（余剰人員を最小化）

### PuLP とは

Pythonの**数理最適化モデリングライブラリ**です。上記のような最適化問題を「数式」としてPythonコードで記述できます。

```python
from pulp import *

# 問題を定義
prob = LpProblem("ShiftScheduling", LpMinimize)

# 決定変数を作成（0 or 1のバイナリ変数）
x = LpVariable("x_田中_3月1日_早番", cat="Binary")

# 制約を追加
prob += x_田中_3月1日_早番 + x_田中_3月1日_遅番 <= 1  # 1日1シフト

# 求解
prob.solve()
```

PuLP自体はモデルを記述するだけで、実際に解を求めるのは**ソルバー**の役割です。

### SCIP とは

**ソルバー**（最適化問題を実際に解くエンジン）の1つです。

```
PuLP（モデリング） → SCIP（求解）
「何を最適化したいか」  「最適解を計算する」
     を記述               エンジン
```

SCIPは混合整数計画問題（MIP）を高速に解ける無償のソルバーです。本プロジェクトではSCIPが利用可能な場合はSCIPを、なければCBC（PuLP内蔵のソルバー）にフォールバックします。

### 整数計画問題（IP / MIP）とは

決定変数が整数値（特に0か1）に制限される最適化問題です。

シフトスケジューリングは典型的な整数計画問題です。「田中さんを3月1日の早番に0.5人分割り当てる」ということはできないため、0か1の二択になります。

```
連続最適化:  x = 0.7 のような小数値もOK（解きやすい）
整数最適化:  x = 0 or 1 のみ（解くのが難しい）
```

整数計画問題はNP困難と呼ばれる計算の難しいクラスに属しますが、SCIPのような高性能ソルバーを使えば、小〜中規模の問題（スタッフ20人程度）であれば数秒で解けます。

---

## 開発ツール

### uv とは

Pythonの**パッケージマネージャー**です。`pip` の高速な代替として使います。

```bash
uv sync          # pyproject.tomlに記載された依存パッケージをインストール
uv add fastapi   # 新しいパッケージを追加
uv run pytest    # 仮想環境内でコマンドを実行
```

従来の `pip install` + `venv` の組み合わせよりも高速で、`pyproject.toml` 1ファイルでプロジェクト設定と依存関係を管理できます。

### npm とは

Node.js（JavaScript/TypeScript実行環境）の**パッケージマネージャー**です。

```bash
npm install      # package.jsonに記載された依存パッケージをインストール
npm run dev      # 開発サーバーを起動
npm run build    # 本番用にビルド
```

### pytest とは

Pythonの**テストフレームワーク**です。

```python
def test_create_staff(client):
    response = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    assert response.status_code == 201  # ← 期待通りの結果かチェック
```

`assert` で「こうなるはず」を宣言し、実際の結果と照合します。テストが全部通れば（PASS）、コードが正しく動いていると確認できます。

```bash
cd backend && uv run pytest -v   # テストを実行（-vで詳細表示）
```

---

## プロジェクトのディレクトリ構造

```
dev-shift-scheduling/
│
├── backend/                     # バックエンド（Python）
│   ├── backend/
│   │   ├── api/                 # APIエンドポイント（URLごとの処理）
│   │   │   ├── staff.py         #   スタッフ管理
│   │   │   ├── shift_slots.py   #   シフト枠管理
│   │   │   ├── staffing_requirements.py  # 必要人数管理
│   │   │   ├── requests.py      #   スタッフ希望管理
│   │   │   └── schedules.py     #   スケジュール管理 + 最適化実行
│   │   ├── optimizer/
│   │   │   └── solver.py        # 数理最適化ロジック（PuLP + SCIP）
│   │   ├── models.py            # データベーステーブル定義（SQLAlchemy）
│   │   ├── schemas.py           # 入出力データ定義（Pydantic）
│   │   ├── database.py          # データベース接続設定
│   │   └── main.py              # アプリケーション起動設定
│   ├── tests/                   # テストコード
│   └── pyproject.toml           # Python依存パッケージ定義
│
├── frontend/                    # フロントエンド（TypeScript）
│   ├── app/                     # ページ（URLに対応）
│   │   ├── schedule/page.tsx    #   シフト表画面
│   │   ├── settings/page.tsx    #   設定画面
│   │   └── staff/page.tsx       #   希望入力画面
│   ├── components/              # UIコンポーネント（再利用可能な部品）
│   │   ├── ui/                  #   shadcn/ui基本部品
│   │   ├── shift-calendar.tsx   #   シフトカレンダー
│   │   ├── staff-table.tsx      #   スタッフ管理テーブル
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts               # バックエンドAPI呼び出しユーティリティ
│   │   └── types.ts             # TypeScript型定義
│   └── package.json             # Node.js依存パッケージ定義
│
└── docs/                        # ドキュメント
    ├── plans/                   # 設計書・実装計画
    ├── usage-guide.md           # 使い方ガイド
    └── technical-guide.md       # 技術ガイド（このファイル）
```

---

## データの流れ（具体例）

「最適化実行」ボタンを押したときの処理の流れ:

```
1. ブラウザ
   → 「最適化実行」ボタンをクリック

2. フロントエンド（schedule/page.tsx）
   → apiFetch("POST /api/schedules/1/optimize") を呼び出し

3. バックエンド（schedules.py: optimize_schedule）
   → DBからスタッフ・シフト枠・必要人数・希望データを取得
   → solve_schedule() を呼び出し

4. 最適化エンジン（solver.py）
   → PuLPで数理モデルを構築
   → SCIPで求解（数秒）
   → 結果（どのスタッフをいつどのシフトに割り当てるか）を返す

5. バックエンド（schedules.py）
   → 結果をDBに保存
   → JSON形式でフロントエンドに返す

6. フロントエンド（shift-calendar.tsx）
   → 受け取ったデータをカレンダー形式で画面に描画
```

---

## 参考リンク

| 技術 | 公式サイト |
|------|-----------|
| Next.js | https://nextjs.org/ |
| React | https://react.dev/ |
| TypeScript | https://www.typescriptlang.org/ |
| Tailwind CSS | https://tailwindcss.com/ |
| shadcn/ui | https://ui.shadcn.com/ |
| FastAPI | https://fastapi.tiangolo.com/ |
| SQLAlchemy | https://www.sqlalchemy.org/ |
| Pydantic | https://docs.pydantic.dev/ |
| PuLP | https://coin-or.github.io/pulp/ |
| SCIP | https://www.scipopt.org/ |
| uv | https://docs.astral.sh/uv/ |
| pytest | https://docs.pytest.org/ |
