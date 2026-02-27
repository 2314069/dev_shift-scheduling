# 設計書: 逆循環シフト禁止制約 & スキル・資格配置制約

> 作成日: 2026-02-27

---

## 機能1: 逆循環シフト禁止制約

### 目的

遅番の翌日に早番を配置する「逆循環」パターンを最適化制約で禁止する。

### 定義

- 翌日のシフト開始時刻 < 当日のシフト開始時刻 → 逆循環 → 禁止
- 例: 遅番(15:00始) → 翌日早番(9:00始): 9 < 15 → 禁止
- 例: 早番(9:00始) → 翌日遅番(15:00始): 15 > 9 → OK（正循環）

### 変更箇所

```
バックエンド変更のみ（フロントエンドはトグル表示のみ）

backend/backend/models.py
└── SolverConfigModel に enable_reverse_cycle_prohibition: bool (default=False) を追加

backend/backend/domain.py
└── SolverConfig に enable_reverse_cycle_prohibition: bool を追加

backend/backend/schemas.py
└── SolverConfigSchema / SolverConfigResponse に追加

backend/backend/optimizer/solver.py
└── solve_schedule() 内に新制約を追加
    for d1, d2 in adjacent_dates:
        for (t_a, t_b) where t_b.start_time < t_a.start_time:
            x[s, d1, t_a] + x[s, d2, t_b] <= 1

frontend/components/solver-config-panel.tsx
└── enable_reverse_cycle_prohibition トグルを追加
```

### LP制約

```
# 逆循環禁止（全スタッフ、全隣接日、逆順シフトペア）
if config.enable_reverse_cycle_prohibition:
    reverse_pairs = [(t_a.id, t_b.id) for t_a in slots for t_b in slots
                     if t_b.start_time < t_a.start_time]
    for s in staff_list:
        for i in range(len(dates) - 1):
            d1, d2 = dates[i], dates[i+1]
            for t_a_id, t_b_id in reverse_pairs:
                prob += x[s, d1, t_a_id] + x[s, d2, t_b_id] <= 1
```

---

## 機能2: スキル・資格の配置制約

### 目的

スタッフが複数のスキル・資格を持てるようにし、特定のシフト枠に「調理師免許保持者を1名以上」などの配置制約を設定できるようにする。

### データモデル

```
staff_skills テーブル
├── id: int (PK)
├── staff_id: int (FK → staff.id)
└── skill: str (例: "調理師免許")

skill_requirements テーブル
├── id: int (PK)
├── shift_slot_id: int (FK → shift_slots.id)
├── day_type: str ("weekday" | "weekend")
├── skill: str
└── min_count: int
```

### 変更箇所

```
バックエンド
├── backend/models.py: StaffSkillModel, SkillRequirementModel 追加
├── backend/domain.py: StaffSkill, SkillRequirement dataclass 追加
├── backend/schemas.py: スキル関連スキーマ追加
├── backend/repositories/skill.py: 新規リポジトリ
├── backend/api/skills.py: スタッフスキル CRUD API
├── backend/api/skill_requirements.py: スキル要件 CRUD API
├── backend/main.py: ルーター登録
├── backend/services/__init__.py: SkillService エクスポート
└── backend/optimizer/solver.py:
    - enable_skill_staffing トグル対応
    - SolverConfigModel に enable_skill_staffing: bool (default=False) 追加
    - スキル配置制約追加

フロントエンド
├── frontend/lib/types.ts: StaffSkill, SkillRequirement 型追加
├── frontend/lib/api.ts: スキル関連 API 関数追加（不要な場合スキップ）
└── frontend/app/settings/page.tsx: スキル管理 UI 追加
    ├── スタッフテーブルにスキルタグ + 追加/削除 UI
    └── 「スキル要件」セクション（shift_slot × day_type × skill × min_count）
```

### LP制約

```
# スキル配置制約
if config.enable_skill_staffing and skill_requirements:
    for sr in skill_requirements:
        eligible = [s for s in staff_list if sr.skill in staff_skills_map[s.id]]
        for d in dates:
            if _get_day_type(d) == sr.day_type:
                prob += lpSum(x[s.id, d, sr.shift_slot_id] for s in eligible) >= sr.min_count
```

### API エンドポイント

```
スタッフスキル
GET    /api/staff/{staff_id}/skills
POST   /api/staff/{staff_id}/skills    body: { skill: string }
DELETE /api/staff/{staff_id}/skills/{skill_id}

スキル要件
GET    /api/skill-requirements
POST   /api/skill-requirements
DELETE /api/skill-requirements/{id}
```

### フロントエンド UI

```
設定画面（/settings）
├── スタッフテーブル: 名前列の隣にスキルタグ一覧 + [+追加] ボタン
└── スキル要件セクション（新規）:
    ├── シフト枠 × 平日/休日 × スキル名 × 最低人数
    └── 追加/削除ボタン
```

---

## 実装順序

1. 機能1: 逆循環禁止（バックエンド3ファイル + フロントエンド1ファイル）
2. 機能2: スキル・資格（バックエンド多数 + フロントエンド設定画面）
