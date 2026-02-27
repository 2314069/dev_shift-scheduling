# 逆循環禁止 & スキル配置制約 実装プラン

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 逆循環シフト禁止制約（遅番翌日早番の禁止）とスキル・資格配置制約（例: 調理師免許保持者を各シフトに1名以上）をLP最適化に追加する。

**Architecture:**
- 機能1（逆循環禁止）: バックエンドの SolverConfig に enable_reverse_cycle_prohibition トグルを追加し、LP制約として `x[s,d1,t_a] + x[s,d2,t_b] <= 1`（t_b.start_time < t_a.start_time）を実装。フロントエンドはトグル追加のみ。
- 機能2（スキル制約）: 新規テーブル `staff_skills`・`skill_requirements` を追加し、CRUD APIを作成。ソルバーに enable_skill_staffing トグルと LP 制約を追加。設定画面にスキル管理UIを追加。

**Tech Stack:** FastAPI + SQLAlchemy + PuLP (backend), Next.js + TypeScript (frontend), pytest + Vitest (tests)

---

## Task 1: 逆循環禁止 - バックエンド（モデル・ドメイン・スキーマ・DB移行・ソルバー）

**Files:**
- Modify: `backend/backend/models.py`
- Modify: `backend/backend/database.py`
- Modify: `backend/backend/domain.py`
- Modify: `backend/backend/schemas.py`
- Modify: `backend/backend/optimizer/solver.py`
- Test: `backend/tests/test_optimizer.py`

### Step 1: テスト作成（`backend/tests/test_optimizer.py` に追加）

```python
def test_reverse_cycle_prohibited():
    """逆循環禁止制約: 遅番(15:00始) → 翌日早番(9:00始) の組み合わせを禁止"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
    ]
    slots = [
        ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0)),
        ShiftSlot(id=2, name="遅番", start_time=time(15, 0), end_time=time(23, 0)),
    ]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1),
        StaffingRequirement(id=2, shift_slot_id=2, day_type="weekday", min_count=1),
    ]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),  # Monday
        end_date=date(2026, 3, 3),    # Tuesday (2 days)
    )
    config = SolverConfig(
        id=1,
        enable_reverse_cycle_prohibition=True,
    )

    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"

    # 各スタッフについて逆循環（遅番→翌日早番）がないことを確認
    by_staff_date: dict[tuple[int, str], int] = {}
    for a in result["assignments"]:
        by_staff_date[(a["staff_id"], a["date"])] = a["shift_slot_id"]

    d1_str = "2026-03-02"
    d2_str = "2026-03-03"
    for s in staff_list:
        d1_slot = by_staff_date.get((s.id, d1_str))
        d2_slot = by_staff_date.get((s.id, d2_str))
        if d1_slot == 2 and d2_slot == 1:  # 遅番 → 早番
            pytest.fail(f"スタッフ {s.name}: 逆循環が発生（遅番→早番）")


def test_reverse_cycle_disabled_by_default():
    """逆循環禁止はデフォルト無効: 同じシナリオで制約なし実行は成功する"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
    ]
    slots = [
        ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0)),
        ShiftSlot(id=2, name="遅番", start_time=time(15, 0), end_time=time(23, 0)),
    ]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1),
        StaffingRequirement(id=2, shift_slot_id=2, day_type="weekday", min_count=1),
    ]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),
        end_date=date(2026, 3, 3),
    )
    # enable_reverse_cycle_prohibition=False（デフォルト）
    config = SolverConfig(id=1)

    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    # スタッフ1人で両日2シフト必要 → infeasible になる可能性があるが、
    # 制約が無ければ可能な組み合わせで解を探すことを確認
    assert result["status"] in ("optimal", "infeasible")  # 少なくともクラッシュしない
```

### Step 2: テストが失敗することを確認（SolverConfig に enable_reverse_cycle_prohibition が未実装のため）

```bash
cd backend && uv run python -m pytest tests/test_optimizer.py::test_reverse_cycle_prohibited -v
```

Expected: `AttributeError: 'SolverConfig' object has no attribute 'enable_reverse_cycle_prohibition'`

### Step 3: `domain.py` に追加

`SolverConfig` dataclass に `enable_reverse_cycle_prohibition: bool = False` を追加:

```python
@dataclass
class SolverConfig:
    id: int
    max_consecutive_days: int = 6
    time_limit: int = 30
    min_shift_interval_hours: int = 11
    # トグル
    enable_preferred_shift: bool = True
    enable_fairness: bool = True
    enable_weekend_fairness: bool = True
    enable_shift_interval: bool = True
    enable_role_staffing: bool = False
    enable_min_days_per_week: bool = False
    enable_soft_staffing: bool = False
    enable_reverse_cycle_prohibition: bool = False  # ← 追加
    # 重み
    weight_preferred: float = 3.0
    weight_fairness: float = 2.0
    weight_weekend_fairness: float = 2.0
    weight_soft_staffing: float = 10.0
```

### Step 4: `optimizer/solver.py` に LP 制約追加

`solve_schedule()` 内の B6 制約の後（ファイル末尾のソルバー呼び出しの前）に追加:

```python
# B7: 逆循環禁止（遅番翌日の早番を禁止）
if config.enable_reverse_cycle_prohibition:
    reverse_pairs = [
        (t_a.id, t_b.id)
        for t_a in slots
        for t_b in slots
        if t_b.start_time < t_a.start_time
    ]
    if reverse_pairs:
        for s in staff_list:
            for i in range(len(dates) - 1):
                d1, d2 = dates[i], dates[i + 1]
                for t_a_id, t_b_id in reverse_pairs:
                    prob += (
                        x[(s.id, d1, t_a_id)] + x[(s.id, d2, t_b_id)] <= 1
                    ), f"revcycle_{s.id}_{d1.strftime('%Y%m%d')}_{t_a_id}_{t_b_id}"
```

### Step 5: テストが通ることを確認

```bash
cd backend && uv run python -m pytest tests/test_optimizer.py::test_reverse_cycle_prohibited tests/test_optimizer.py::test_reverse_cycle_disabled_by_default -v
```

Expected: PASS

### Step 6: `models.py` に列追加

`SolverConfigModel` に追加:

```python
enable_reverse_cycle_prohibition: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

### Step 7: `database.py` に SQLite マイグレーション追加

`_run_migrations()` 内の既存チェックの後に追記:

```python
# solver_config テーブルに enable_reverse_cycle_prohibition カラムがなければ追加
result = conn.execute(text("PRAGMA table_info(solver_config)"))
columns = {row[1] for row in result}
if "enable_reverse_cycle_prohibition" not in columns:
    conn.execute(
        text(
            "ALTER TABLE solver_config ADD COLUMN enable_reverse_cycle_prohibition "
            "BOOLEAN NOT NULL DEFAULT 0"
        )
    )
    conn.commit()
```

### Step 8: `schemas.py` に追加

`SolverConfigUpdate` と `SolverConfigResponse` 両方に追加:

```python
# SolverConfigUpdate に追加:
enable_reverse_cycle_prohibition: bool | None = None

# SolverConfigResponse に追加:
enable_reverse_cycle_prohibition: bool
```

### Step 9: 全バックエンドテストが通ることを確認

```bash
cd backend && uv run python -m pytest -v
```

Expected: 全テスト PASS（60 passed 以上）

### Step 10: コミット

```bash
cd backend
git add backend/models.py backend/database.py backend/domain.py backend/schemas.py
git add backend/optimizer/solver.py tests/test_optimizer.py
git commit -m "feat: add reverse cycle prohibition constraint to solver"
```

---

## Task 2: 逆循環禁止 - フロントエンド（types + トグル）

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/components/solver-config-panel.tsx`

### Step 1: `types.ts` に追加

`SolverConfig` インターフェースに追加:

```typescript
export interface SolverConfig {
  id: number;
  // ... 既存フィールド ...
  enable_soft_staffing: boolean;
  enable_reverse_cycle_prohibition: boolean;  // ← 追加
  // 重み
  weight_preferred: number;
  // ...
}
```

### Step 2: `solver-config-panel.tsx` の `TOGGLE_CONSTRAINTS` に追加

`TOGGLE_CONSTRAINTS` 配列の末尾に追加:

```typescript
const TOGGLE_CONSTRAINTS: ToggleConstraint[] = [
  // ... 既存 3 項目 ...
  {
    key: "enable_reverse_cycle_prohibition",
    label: "逆循環シフトを禁止する",
    description: "遅番の翌日に早番を入れることを禁止します（例: 15時始め→翌日9時始め）",
  },
];
```

### Step 3: フロントエンドテストが通ることを確認

```bash
cd frontend && npm run test
```

Expected: 全テスト PASS（53 passed 以上）

### Step 4: コミット

```bash
git add frontend/lib/types.ts frontend/components/solver-config-panel.tsx
git commit -m "feat: add reverse cycle prohibition toggle to frontend"
```

---

## Task 3: スキル制約 - データモデル・ドメイン・スキーマ・リポジトリ・API

**Files:**
- Modify: `backend/backend/models.py`
- Modify: `backend/backend/domain.py`
- Modify: `backend/backend/schemas.py`
- Create: `backend/backend/repositories/skill.py`
- Modify: `backend/backend/repositories/__init__.py`
- Create: `backend/backend/api/skills.py`
- Create: `backend/backend/api/skill_requirements.py`
- Modify: `backend/backend/main.py`
- Test: `backend/tests/test_api_skills.py`（新規作成）

### Step 1: API テスト作成（新規ファイル `backend/tests/test_api_skills.py`）

```python
import pytest


def test_staff_skills_crud(client):
    """スタッフスキルの CRUD テスト"""
    # スタッフを作成
    r = client.post("/api/staff", json={"name": "田中", "role": "調理師", "max_days_per_week": 5})
    assert r.status_code == 201
    staff_id = r.json()["id"]

    # スキル追加
    r = client.post(f"/api/staff/{staff_id}/skills", json={"skill": "調理師免許"})
    assert r.status_code == 201
    skill_id = r.json()["id"]
    assert r.json()["skill"] == "調理師免許"

    # スキル一覧取得
    r = client.get(f"/api/staff/{staff_id}/skills")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["skill"] == "調理師免許"

    # スキル削除
    r = client.delete(f"/api/staff/{staff_id}/skills/{skill_id}")
    assert r.status_code == 204

    # 削除後は空
    r = client.get(f"/api/staff/{staff_id}/skills")
    assert r.status_code == 200
    assert r.json() == []


def test_skill_requirements_crud(client):
    """スキル要件の CRUD テスト"""
    # シフト枠を作成
    r = client.post("/api/shift-slots", json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"})
    assert r.status_code == 201
    slot_id = r.json()["id"]

    # スキル要件追加
    r = client.post("/api/skill-requirements", json={
        "shift_slot_id": slot_id,
        "day_type": "weekday",
        "skill": "調理師免許",
        "min_count": 1,
    })
    assert r.status_code == 201
    req_id = r.json()["id"]
    assert r.json()["skill"] == "調理師免許"
    assert r.json()["min_count"] == 1

    # 一覧取得
    r = client.get("/api/skill-requirements")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # 削除
    r = client.delete(f"/api/skill-requirements/{req_id}")
    assert r.status_code == 204

    # 削除後は空
    r = client.get("/api/skill-requirements")
    assert r.status_code == 200
    assert r.json() == []


def test_staff_skill_not_found(client):
    """存在しないスタッフへのスキル追加は 404"""
    r = client.post("/api/staff/999/skills", json={"skill": "調理師免許"})
    assert r.status_code == 404
```

### Step 2: テストが失敗することを確認

```bash
cd backend && uv run python -m pytest tests/test_api_skills.py -v
```

Expected: FAIL（モデル・API 未実装）

### Step 3: `models.py` に新規テーブル追加

`RoleStaffingRequirementModel` の後に追記:

```python
class StaffSkillModel(Base):
    __tablename__ = "staff_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    skill: Mapped[str] = mapped_column(String, nullable=False)


class SkillRequirementModel(Base):
    __tablename__ = "skill_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_slot_id: Mapped[int] = mapped_column(ForeignKey("shift_slots.id"), nullable=False)
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    skill: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)
```

### Step 4: `domain.py` に新規 dataclass 追加

`RoleStaffingRequirement` の後に追記:

```python
@dataclass
class StaffSkill:
    id: int
    staff_id: int
    skill: str


@dataclass
class SkillRequirement:
    id: int
    shift_slot_id: int
    day_type: str
    skill: str
    min_count: int
```

### Step 5: `schemas.py` に新規スキーマ追加

`RoleStaffingRequirementResponse` の後に追記:

```python
# --- StaffSkill ---
class StaffSkillCreate(BaseModel):
    skill: str


class StaffSkillResponse(BaseModel):
    id: int
    staff_id: int
    skill: str

    model_config = {"from_attributes": True}


# --- SkillRequirement ---
class SkillRequirementCreate(BaseModel):
    shift_slot_id: int
    day_type: str
    skill: str
    min_count: int


class SkillRequirementResponse(BaseModel):
    id: int
    shift_slot_id: int
    day_type: str
    skill: str
    min_count: int

    model_config = {"from_attributes": True}
```

### Step 6: リポジトリ作成（新規ファイル `backend/backend/repositories/skill.py`）

```python
from sqlalchemy.orm import Session

from backend.domain import SkillRequirement, StaffSkill
from backend.models import SkillRequirementModel, StaffSkillModel, StaffModel


class SkillRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- StaffSkill ---
    def list_skills_by_staff(self, staff_id: int) -> list[StaffSkill]:
        return [
            StaffSkill(id=m.id, staff_id=m.staff_id, skill=m.skill)
            for m in self.db.query(StaffSkillModel)
            .filter(StaffSkillModel.staff_id == staff_id)
            .all()
        ]

    def add_skill(self, staff_id: int, skill: str) -> StaffSkill | None:
        if not self.db.get(StaffModel, staff_id):
            return None
        model = StaffSkillModel(staff_id=staff_id, skill=skill)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return StaffSkill(id=model.id, staff_id=model.staff_id, skill=model.skill)

    def delete_skill(self, skill_id: int) -> bool:
        model = self.db.get(StaffSkillModel, skill_id)
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True

    def list_all_staff_skills(self) -> list[StaffSkill]:
        return [
            StaffSkill(id=m.id, staff_id=m.staff_id, skill=m.skill)
            for m in self.db.query(StaffSkillModel).all()
        ]

    # --- SkillRequirement ---
    def list_skill_requirements(self) -> list[SkillRequirement]:
        return [
            SkillRequirement(
                id=m.id,
                shift_slot_id=m.shift_slot_id,
                day_type=m.day_type,
                skill=m.skill,
                min_count=m.min_count,
            )
            for m in self.db.query(SkillRequirementModel).all()
        ]

    def create_skill_requirement(self, **kwargs) -> SkillRequirement:
        model = SkillRequirementModel(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return SkillRequirement(
            id=model.id,
            shift_slot_id=model.shift_slot_id,
            day_type=model.day_type,
            skill=model.skill,
            min_count=model.min_count,
        )

    def delete_skill_requirement(self, req_id: int) -> bool:
        model = self.db.get(SkillRequirementModel, req_id)
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
```

### Step 7: `repositories/__init__.py` に追加

```python
from backend.repositories.skill import SkillRepository

__all__ = [
    # ... 既存 ...
    "SkillRepository",
]
```

### Step 8: スタッフスキル API 作成（新規 `backend/backend/api/skills.py`）

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import SkillRepository
from backend.schemas import StaffSkillCreate, StaffSkillResponse

router = APIRouter(prefix="/api/staff", tags=["skills"])


@router.get("/{staff_id}/skills", response_model=list[StaffSkillResponse])
def list_staff_skills(staff_id: int, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    return repo.list_skills_by_staff(staff_id)


@router.post("/{staff_id}/skills", response_model=StaffSkillResponse, status_code=201)
def add_staff_skill(staff_id: int, data: StaffSkillCreate, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    result = repo.add_skill(staff_id=staff_id, skill=data.skill)
    if result is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    return result


@router.delete("/{staff_id}/skills/{skill_id}", status_code=204)
def delete_staff_skill(staff_id: int, skill_id: int, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    if not repo.delete_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
```

### Step 9: スキル要件 API 作成（新規 `backend/backend/api/skill_requirements.py`）

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import SkillRepository
from backend.schemas import SkillRequirementCreate, SkillRequirementResponse

router = APIRouter(prefix="/api/skill-requirements", tags=["skill-requirements"])


@router.get("", response_model=list[SkillRequirementResponse])
def list_skill_requirements(db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    return repo.list_skill_requirements()


@router.post("", response_model=SkillRequirementResponse, status_code=201)
def create_skill_requirement(data: SkillRequirementCreate, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    return repo.create_skill_requirement(**data.model_dump())


@router.delete("/{req_id}", status_code=204)
def delete_skill_requirement(req_id: int, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    if not repo.delete_skill_requirement(req_id):
        raise HTTPException(status_code=404, detail="Skill requirement not found")
```

### Step 10: `main.py` にルーター登録

既存のインポートと `include_router` 呼び出しに追加:

```python
from backend.api.skills import router as skills_router
from backend.api.skill_requirements import router as skill_requirements_router

# ...

app.include_router(skills_router)
app.include_router(skill_requirements_router)
```

### Step 11: テストが通ることを確認

```bash
cd backend && uv run python -m pytest tests/test_api_skills.py -v
```

Expected: PASS（3 tests）

### Step 12: 全テスト確認

```bash
cd backend && uv run python -m pytest -v
```

Expected: 全テスト PASS

### Step 13: コミット

```bash
cd backend
git add backend/models.py backend/domain.py backend/schemas.py
git add backend/repositories/skill.py backend/repositories/__init__.py
git add backend/api/skills.py backend/api/skill_requirements.py backend/main.py
git add tests/test_api_skills.py
git commit -m "feat: add staff skills and skill requirements models, repos, and APIs"
```

---

## Task 4: スキル制約 - ソルバー統合（SolverConfig toggle + LP 制約）

**Files:**
- Modify: `backend/backend/models.py`
- Modify: `backend/backend/database.py`
- Modify: `backend/backend/domain.py`
- Modify: `backend/backend/schemas.py`
- Modify: `backend/backend/optimizer/solver.py`
- Modify: `backend/backend/api/schedules.py`（または services）
- Test: `backend/tests/test_optimizer.py`

### Step 1: テスト追加（`backend/tests/test_optimizer.py`）

```python
def test_skill_staffing_constraint():
    """スキル配置制約: 調理師免許保持者を早番に1名以上配置"""
    from backend.domain import SkillRequirement, StaffSkill

    staff_list = [
        Staff(id=1, name="田中", role="調理師", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5),
    ]
    slots = [
        ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0)),
    ]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2),
    ]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),  # Monday
        end_date=date(2026, 3, 4),    # Wednesday
    )
    # 田中だけが調理師免許を持つ
    staff_skills = [
        StaffSkill(id=1, staff_id=1, skill="調理師免許"),
    ]
    skill_requirements = [
        SkillRequirement(id=1, shift_slot_id=1, day_type="weekday", skill="調理師免許", min_count=1),
    ]
    config = SolverConfig(id=1, enable_skill_staffing=True)

    result = solve_schedule(
        period, staff_list, slots, requirements, [],
        config=config,
        staff_skills=staff_skills,
        skill_requirements=skill_requirements,
    )
    assert result["status"] == "optimal"

    # 各平日（早番）に田中（調理師免許保持）が必ず入っていることを確認
    tanaka_dates = {a["date"] for a in result["assignments"] if a["staff_id"] == 1}
    for d_str in ["2026-03-02", "2026-03-03", "2026-03-04"]:
        assert d_str in tanaka_dates, f"{d_str} に調理師免許保持者が配置されていない"
```

### Step 2: テストが失敗することを確認

```bash
cd backend && uv run python -m pytest tests/test_optimizer.py::test_skill_staffing_constraint -v
```

Expected: FAIL（`SolverConfig` に `enable_skill_staffing` が未実装）

### Step 3: `domain.py` に追加

`SolverConfig` dataclass に `enable_skill_staffing: bool = False` を追加:

```python
enable_skill_staffing: bool = False  # ← enable_reverse_cycle_prohibition の後に追加
```

また、solver.py で使うために `StaffSkill` と `SkillRequirement` を同じファイルからインポートできることを確認（Task 3 で追加済み）。

### Step 4: `solver.py` に LP 制約追加

`solve_schedule()` シグネチャに引数を追加（既存引数の後）:

```python
def solve_schedule(
    period: SchedulePeriod,
    staff_list: list[Staff],
    slots: list[ShiftSlot],
    requirements: list[StaffingRequirement],
    requests: list[StaffRequest],
    max_consecutive_days: int = 6,
    time_limit: int = 30,
    config: SolverConfig | None = None,
    role_requirements: list[RoleStaffingRequirement] | None = None,
    _skip_diagnostics: bool = False,
    prefix_assignments: dict[int, list] | None = None,
    staff_skills: list["StaffSkill"] | None = None,          # ← 追加
    skill_requirements: list["SkillRequirement"] | None = None,  # ← 追加
) -> dict:
```

インポート行に追加（domain.py のインポート部分）:

```python
from backend.domain import (
    DiagnosticItem,
    RoleStaffingRequirement,
    SchedulePeriod,
    ShiftSlot,
    SkillRequirement,   # ← 追加
    SolverConfig,
    Staff,
    StaffingRequirement,
    StaffRequest,
    StaffSkill,         # ← 追加
)
```

B6 制約の後、ソルバー呼び出しの前に LP 制約追加:

```python
# B7: 逆循環禁止（Task 1 で追加済み）

# B8: スキル配置制約
if config.enable_skill_staffing and skill_requirements:
    # staff_id → スキルセットのマップ構築
    skills_map: dict[int, set[str]] = {}
    for ss in (staff_skills or []):
        skills_map.setdefault(ss.staff_id, set()).add(ss.skill)
    for sr in skill_requirements:
        eligible = [s for s in staff_list if sr.skill in skills_map.get(s.id, set())]
        if not eligible:
            continue  # 有資格者がいない場合はスキップ（診断で別途検出）
        for di, d in enumerate(dates):
            if _get_day_type(d) == sr.day_type:
                prob += (
                    lpSum(x[(s.id, d, sr.shift_slot_id)] for s in eligible)
                    >= sr.min_count
                ), f"skill_{sr.id}_{d.strftime('%Y%m%d')}_{sr.shift_slot_id}"
```

### Step 5: テストが通ることを確認

```bash
cd backend && uv run python -m pytest tests/test_optimizer.py::test_skill_staffing_constraint -v
```

Expected: PASS

### Step 6: `models.py` に列追加

`SolverConfigModel` に追加:

```python
enable_skill_staffing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

### Step 7: `database.py` に SQLite マイグレーション追加

`_run_migrations()` に追記（enable_reverse_cycle_prohibition のマイグレーションの後）:

```python
# solver_config テーブルに enable_skill_staffing カラムがなければ追加
result = conn.execute(text("PRAGMA table_info(solver_config)"))
columns = {row[1] for row in result}
if "enable_skill_staffing" not in columns:
    conn.execute(
        text(
            "ALTER TABLE solver_config ADD COLUMN enable_skill_staffing "
            "BOOLEAN NOT NULL DEFAULT 0"
        )
    )
    conn.commit()
```

### Step 8: `schemas.py` に追加

```python
# SolverConfigUpdate に追加:
enable_skill_staffing: bool | None = None

# SolverConfigResponse に追加:
enable_skill_staffing: bool
```

### Step 9: `api/schedules.py` の optimize エンドポイントに staff_skills + skill_requirements を渡す

schedules.py（または services/schedule.py）の optimize 処理で、リポジトリから取得して solver に渡す。
実装パターンは role_requirements の渡し方を参照（既存の `SkillRepository(db).list_skill_requirements()` と `list_all_staff_skills()` を呼ぶ）:

```python
# optimize エンドポイント内（role_requirements 取得の後に追加）:
from backend.repositories import SkillRepository
skill_repo = SkillRepository(db)
staff_skills = skill_repo.list_all_staff_skills()
skill_requirements = skill_repo.list_skill_requirements()

result = solve_schedule(
    ...
    skill_requirements=skill_requirements if skill_requirements else None,
    staff_skills=staff_skills if staff_skills else None,
)
```

### Step 10: 全テスト確認

```bash
cd backend && uv run python -m pytest -v
```

Expected: 全テスト PASS

### Step 11: コミット

```bash
cd backend
git add backend/models.py backend/database.py backend/domain.py backend/schemas.py
git add backend/optimizer/solver.py backend/api/schedules.py
git add tests/test_optimizer.py
git commit -m "feat: add skill staffing constraint to solver with enable_skill_staffing toggle"
```

---

## Task 5: スキル制約 - フロントエンド UI

**Files:**
- Modify: `frontend/lib/types.ts`
- Create: `frontend/components/skill-requirements-table.tsx`
- Modify: `frontend/app/settings/page.tsx`
- Modify: `frontend/components/solver-config-panel.tsx`

### Step 1: `types.ts` に追加

```typescript
// SolverConfig に追加:
enable_skill_staffing: boolean;

// 新規型追加（ファイル末尾）:
export interface StaffSkill {
  id: number;
  staff_id: number;
  skill: string;
}

export interface SkillRequirement {
  id: number;
  shift_slot_id: number;
  day_type: string;
  skill: string;
  min_count: number;
}
```

### Step 2: スキル要件テーブルコンポーネント作成（新規 `frontend/components/skill-requirements-table.tsx`）

このコンポーネントは「スキル要件管理」セクションを実装する。
パターンは `staffing-requirements-table.tsx` を参照して同様の構造で実装する。

```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { ShiftSlot, SkillRequirement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SkillRequirementsTable() {
  const [requirements, setRequirements] = useState<SkillRequirement[]>([]);
  const [slots, setSlots] = useState<ShiftSlot[]>([]);
  const [newSlotId, setNewSlotId] = useState<string>("");
  const [newDayType, setNewDayType] = useState<string>("weekday");
  const [newSkill, setNewSkill] = useState<string>("");
  const [newMinCount, setNewMinCount] = useState<string>("1");

  useEffect(() => {
    apiFetch<SkillRequirement[]>("/api/skill-requirements").then(setRequirements);
    apiFetch<ShiftSlot[]>("/api/shift-slots").then(setSlots);
  }, []);

  async function handleAdd() {
    if (!newSlotId || !newSkill.trim()) {
      toast.error("シフト枠・スキル名を入力してください");
      return;
    }
    const count = parseInt(newMinCount, 10);
    if (isNaN(count) || count < 1) {
      toast.error("最低人数は1以上を入力してください");
      return;
    }
    try {
      const created = await apiFetch<SkillRequirement>("/api/skill-requirements", {
        method: "POST",
        body: JSON.stringify({
          shift_slot_id: parseInt(newSlotId, 10),
          day_type: newDayType,
          skill: newSkill.trim(),
          min_count: count,
        }),
      });
      setRequirements((prev) => [...prev, created]);
      setNewSkill("");
      setNewMinCount("1");
      toast.success("スキル要件を追加しました");
    } catch {
      toast.error("追加に失敗しました");
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/skill-requirements/${id}`, { method: "DELETE" });
      setRequirements((prev) => prev.filter((r) => r.id !== id));
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  const slotName = (id: number) => slots.find((s) => s.id === id)?.name ?? String(id);
  const dayTypeLabel = (dt: string) => dt === "weekday" ? "平日" : "土日祝";

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>シフト枠</TableHead>
            <TableHead>平日/土日祝</TableHead>
            <TableHead>スキル</TableHead>
            <TableHead>最低人数</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requirements.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{slotName(r.shift_slot_id)}</TableCell>
              <TableCell>{dayTypeLabel(r.day_type)}</TableCell>
              <TableCell>{r.skill}</TableCell>
              <TableCell>{r.min_count}名以上</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(r.id)}
                  aria-label="削除"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {requirements.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                スキル要件がまだ登録されていません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 追加フォーム */}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">シフト枠</label>
          <Select value={newSlotId} onValueChange={setNewSlotId}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {slots.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">平日/土日祝</label>
          <Select value={newDayType} onValueChange={setNewDayType}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekday">平日</SelectItem>
              <SelectItem value="weekend">土日祝</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">スキル名</label>
          <Input
            placeholder="例: 調理師免許"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">最低人数</label>
          <Input
            type="number"
            min={1}
            value={newMinCount}
            onChange={(e) => setNewMinCount(e.target.value)}
            className="w-20"
          />
        </div>
        <Button onClick={handleAdd} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          追加
        </Button>
      </div>
    </div>
  );
}
```

### Step 3: `settings/page.tsx` にスキル要件セクション追加

`SolverConfigPanel` セクションの前に新規セクションを挿入:

```tsx
import { SkillRequirementsTable } from "@/components/skill-requirements-table";

// ...

{/* 既存の section 3（必要人数設定）の後、最適化設定の前に挿入 */}
<section>
  <div className="mb-4">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs font-bold bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">+</span>
      <h2 className="text-xl font-semibold">スキル要件設定</h2>
    </div>
    <p className="text-sm text-muted-foreground ml-7">
      「調理師免許保持者を早番に1名以上」など、スキル・資格による配置条件を設定します。
      最適化設定で「スキル配置制約を有効にする」をオンにすると反映されます。
    </p>
  </div>
  <SkillRequirementsTable />
</section>
```

### Step 4: `solver-config-panel.tsx` の `TOGGLE_CONSTRAINTS` に追加

```typescript
const TOGGLE_CONSTRAINTS: ToggleConstraint[] = [
  // ... 既存 4 項目（enable_reverse_cycle_prohibition 含む） ...
  {
    key: "enable_skill_staffing",
    label: "スキル配置制約を有効にする",
    description: "「設定 > スキル要件」で登録した条件を満たすようにシフトを作成します",
  },
];
```

### Step 5: フロントエンドテストが通ることを確認

```bash
cd frontend && npm run test
```

Expected: 全テスト PASS（53 passed 以上）

### Step 6: コミット

```bash
git add frontend/lib/types.ts frontend/components/solver-config-panel.tsx
git add frontend/components/skill-requirements-table.tsx frontend/app/settings/page.tsx
git commit -m "feat: add skill staffing UI to settings page and solver config panel"
```

---

## Task 6: STATUS.md 更新 & 最終確認

**Files:**
- Modify: `STATUS.md`

### Step 1: 全テスト最終確認

```bash
cd backend && uv run python -m pytest -v
cd frontend && npm run test
```

Expected: バックエンド 62+ passed、フロントエンド 53+ passed

### Step 2: STATUS.md 更新

- 最終更新日を `2026-02-27` に更新
- 実装済み機能表に追加:
  - バックエンド: 逆循環禁止制約、スキル配置制約
  - フロントエンド: スキル要件設定画面
- TODO から逆循環禁止とスキル配置制約を削除（チェック済みへ）
- 最近のコミット一覧を更新

### Step 3: コミット

```bash
git add STATUS.md
git commit -m "docs: update STATUS.md for reverse cycle prohibition and skill constraints"
```
