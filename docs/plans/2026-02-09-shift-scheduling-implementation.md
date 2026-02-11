# シフトスケジューリングWebアプリ 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 小規模店舗向けの数理最適化ベースのシフトスケジューリングWebアプリのMVPを構築する

**Architecture:** モノレポ構成。FastAPI（Python）でREST APIとPuLP+SCIPによる最適化エンジンを提供し、Next.js（React/TypeScript）でフロントエンドを構築する。データベースはSQLite。

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, FastAPI, SQLAlchemy, PuLP, SCIP, Pydantic, SQLite, uv, npm

---

## Task 1: バックエンド プロジェクト初期化

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/backend/__init__.py`
- Create: `backend/backend/main.py`
- Create: `backend/backend/database.py`
- Create: `.gitignore`

**Step 1: .gitignoreを作成**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
*.db

# Node
node_modules/
.next/
out/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

**Step 2: pyproject.tomlを作成しuvで依存パッケージをインストール**

```toml
[project]
name = "shift-scheduling-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy>=2.0.0",
    "pydantic>=2.0.0",
    "pulp>=2.8.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

Run: `cd backend && uv sync`

**Step 3: database.pyを作成**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = "sqlite:///shift_scheduling.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 4: main.pyを作成**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shift Scheduling API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
```

**Step 5: テストでサーバー起動を確認**

Run: `cd backend && uv run uvicorn backend.main:app --reload --port 8000`
ブラウザで `http://localhost:8000/api/health` にアクセスし `{"status":"ok"}` を確認。サーバーを停止。

**Step 6: コミット**

```bash
git add .gitignore backend/
git commit -m "chore: initialize backend project with FastAPI and SQLite"
```

---

## Task 2: データベースモデル定義

**Files:**
- Create: `backend/backend/models.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_models.py`

**Step 1: テストを書く**

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    Staff,
    ShiftSlot,
    StaffRequest,
    SchedulePeriod,
    ScheduleAssignment,
    StaffingRequirement,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_create_staff(db_session):
    staff = Staff(name="田中太郎", role="リーダー", max_days_per_week=5)
    db_session.add(staff)
    db_session.commit()
    assert staff.id is not None
    assert staff.name == "田中太郎"


def test_create_shift_slot(db_session):
    from datetime import time

    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()
    assert slot.id is not None


def test_create_staff_request(db_session):
    from datetime import date, time

    staff = Staff(name="田中太郎", role="一般", max_days_per_week=5)
    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add_all([staff, slot])
    db_session.commit()

    request = StaffRequest(
        staff_id=staff.id,
        date=date(2026, 3, 1),
        shift_slot_id=slot.id,
        type="preferred",
    )
    db_session.add(request)
    db_session.commit()
    assert request.id is not None


def test_create_schedule_period_and_assignment(db_session):
    from datetime import date, time

    staff = Staff(name="田中太郎", role="一般", max_days_per_week=5)
    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add_all([staff, slot])
    db_session.commit()

    period = SchedulePeriod(
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 15),
        status="draft",
    )
    db_session.add(period)
    db_session.commit()

    assignment = ScheduleAssignment(
        period_id=period.id,
        staff_id=staff.id,
        date=date(2026, 3, 1),
        shift_slot_id=slot.id,
        is_manual_edit=False,
    )
    db_session.add(assignment)
    db_session.commit()
    assert assignment.id is not None


def test_create_staffing_requirement(db_session):
    from datetime import time

    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()

    req = StaffingRequirement(
        shift_slot_id=slot.id,
        day_type="weekday",
        min_count=3,
    )
    db_session.add(req)
    db_session.commit()
    assert req.id is not None
```

**Step 2: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: FAIL（`backend.models` が存在しない）

**Step 3: models.pyを実装**

```python
from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    max_days_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    requests: Mapped[list["StaffRequest"]] = relationship(back_populates="staff")
    assignments: Mapped[list["ScheduleAssignment"]] = relationship(
        back_populates="staff"
    )


class ShiftSlot(Base):
    __tablename__ = "shift_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    requirements: Mapped[list["StaffingRequirement"]] = relationship(
        back_populates="shift_slot"
    )


class StaffRequest(Base):
    __tablename__ = "staff_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)

    staff: Mapped["Staff"] = relationship(back_populates="requests")


class SchedulePeriod(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")

    assignments: Mapped[list["ScheduleAssignment"]] = relationship(
        back_populates="period"
    )


class ScheduleAssignment(Base):
    __tablename__ = "schedule_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_periods.id"), nullable=False
    )
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=True
    )
    is_manual_edit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    period: Mapped["SchedulePeriod"] = relationship(back_populates="assignments")
    staff: Mapped["Staff"] = relationship(back_populates="assignments")


class StaffingRequirement(Base):
    __tablename__ = "staffing_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shift_slot: Mapped["ShiftSlot"] = relationship(back_populates="requirements")
```

**Step 4: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: 全5テストPASS

**Step 5: main.pyでmodelsをimport**

`backend/main.py` の先頭に追加:
```python
from backend import models  # noqa: F401
```
これによりアプリ起動時にテーブルが作成される。

**Step 6: コミット**

```bash
git add backend/
git commit -m "feat: add database models for all entities"
```

---

## Task 3: Pydanticスキーマ定義

**Files:**
- Create: `backend/backend/schemas.py`

**Step 1: schemas.pyを作成**

```python
from datetime import date, time

from pydantic import BaseModel


# --- Staff ---
class StaffCreate(BaseModel):
    name: str
    role: str
    max_days_per_week: int = 5


class StaffUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    max_days_per_week: int | None = None


class StaffResponse(BaseModel):
    id: int
    name: str
    role: str
    max_days_per_week: int

    model_config = {"from_attributes": True}


# --- ShiftSlot ---
class ShiftSlotCreate(BaseModel):
    name: str
    start_time: time
    end_time: time


class ShiftSlotUpdate(BaseModel):
    name: str | None = None
    start_time: time | None = None
    end_time: time | None = None


class ShiftSlotResponse(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


# --- StaffingRequirement ---
class StaffingRequirementCreate(BaseModel):
    shift_slot_id: int
    day_type: str
    min_count: int


class StaffingRequirementUpdate(BaseModel):
    min_count: int


class StaffingRequirementResponse(BaseModel):
    id: int
    shift_slot_id: int
    day_type: str
    min_count: int

    model_config = {"from_attributes": True}


# --- StaffRequest ---
class StaffRequestItem(BaseModel):
    staff_id: int
    date: date
    shift_slot_id: int | None = None
    type: str  # "preferred" or "unavailable"


class StaffRequestBulkCreate(BaseModel):
    period_id: int
    requests: list[StaffRequestItem]


class StaffRequestResponse(BaseModel):
    id: int
    staff_id: int
    date: date
    shift_slot_id: int | None
    type: str

    model_config = {"from_attributes": True}


# --- SchedulePeriod ---
class SchedulePeriodCreate(BaseModel):
    start_date: date
    end_date: date


class SchedulePeriodResponse(BaseModel):
    id: int
    start_date: date
    end_date: date
    status: str

    model_config = {"from_attributes": True}


# --- ScheduleAssignment ---
class ScheduleAssignmentResponse(BaseModel):
    id: int
    period_id: int
    staff_id: int
    date: date
    shift_slot_id: int | None
    is_manual_edit: bool

    model_config = {"from_attributes": True}


class ScheduleAssignmentUpdate(BaseModel):
    shift_slot_id: int | None = None


class ScheduleResponse(BaseModel):
    period: SchedulePeriodResponse
    assignments: list[ScheduleAssignmentResponse]


# --- Optimize ---
class OptimizeResponse(BaseModel):
    status: str  # "optimal", "infeasible"
    message: str
    assignments: list[ScheduleAssignmentResponse]
```

**Step 2: コミット**

```bash
git add backend/backend/schemas.py
git commit -m "feat: add Pydantic schemas for API request/response"
```

---

## Task 4: スタッフ管理API

**Files:**
- Create: `backend/backend/api/__init__.py`
- Create: `backend/backend/api/staff.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_api_staff.py`

**Step 1: conftest.pyを作成（テスト用DBセットアップ）**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

**Step 2: テストを書く**

```python
def test_create_staff(client):
    response = client.post(
        "/api/staff",
        json={"name": "田中太郎", "role": "リーダー", "max_days_per_week": 5},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "田中太郎"
    assert data["id"] is not None


def test_list_staff(client):
    client.post("/api/staff", json={"name": "田中", "role": "一般"})
    client.post("/api/staff", json={"name": "佐藤", "role": "一般"})
    response = client.get("/api/staff")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_staff(client):
    res = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    staff_id = res.json()["id"]
    response = client.put(f"/api/staff/{staff_id}", json={"role": "リーダー"})
    assert response.status_code == 200
    assert response.json()["role"] == "リーダー"


def test_delete_staff(client):
    res = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    staff_id = res.json()["id"]
    response = client.delete(f"/api/staff/{staff_id}")
    assert response.status_code == 204
    assert client.get("/api/staff").json() == []
```

**Step 3: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_api_staff.py -v`
Expected: FAIL

**Step 4: staff.pyを実装**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Staff
from backend.schemas import StaffCreate, StaffResponse, StaffUpdate

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("", response_model=list[StaffResponse])
def list_staff(db: Session = Depends(get_db)):
    return db.query(Staff).all()


@router.post("", response_model=StaffResponse, status_code=201)
def create_staff(data: StaffCreate, db: Session = Depends(get_db)):
    staff = Staff(**data.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{staff_id}", response_model=StaffResponse)
def update_staff(staff_id: int, data: StaffUpdate, db: Session = Depends(get_db)):
    staff = db.query(Staff).get(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(staff, key, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=204)
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).get(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(staff)
    db.commit()
```

**Step 5: main.pyにルーターを登録**

```python
from backend.api.staff import router as staff_router
app.include_router(staff_router)
```

**Step 6: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_api_staff.py -v`
Expected: 全4テストPASS

**Step 7: コミット**

```bash
git add backend/
git commit -m "feat: add staff CRUD API with tests"
```

---

## Task 5: シフト枠管理API

**Files:**
- Create: `backend/backend/api/shift_slots.py`
- Create: `backend/tests/test_api_shift_slots.py`

**Step 1: テストを書く**

```python
from datetime import time


def test_create_shift_slot(client):
    response = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "早番"


def test_list_shift_slots(client):
    client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    client.post(
        "/api/shift-slots",
        json={"name": "遅番", "start_time": "13:00:00", "end_time": "21:00:00"},
    )
    response = client.get("/api/shift-slots")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_shift_slot(client):
    res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = res.json()["id"]
    response = client.put(f"/api/shift-slots/{slot_id}", json={"name": "朝番"})
    assert response.status_code == 200
    assert response.json()["name"] == "朝番"


def test_delete_shift_slot(client):
    res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = res.json()["id"]
    response = client.delete(f"/api/shift-slots/{slot_id}")
    assert response.status_code == 204
```

**Step 2: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_api_shift_slots.py -v`
Expected: FAIL

**Step 3: shift_slots.pyを実装**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ShiftSlot
from backend.schemas import ShiftSlotCreate, ShiftSlotResponse, ShiftSlotUpdate

router = APIRouter(prefix="/api/shift-slots", tags=["shift-slots"])


@router.get("", response_model=list[ShiftSlotResponse])
def list_shift_slots(db: Session = Depends(get_db)):
    return db.query(ShiftSlot).all()


@router.post("", response_model=ShiftSlotResponse, status_code=201)
def create_shift_slot(data: ShiftSlotCreate, db: Session = Depends(get_db)):
    slot = ShiftSlot(**data.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.put("/{slot_id}", response_model=ShiftSlotResponse)
def update_shift_slot(
    slot_id: int, data: ShiftSlotUpdate, db: Session = Depends(get_db)
):
    slot = db.query(ShiftSlot).get(slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(slot, key, value)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_shift_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(ShiftSlot).get(slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    db.delete(slot)
    db.commit()
```

**Step 4: main.pyにルーターを登録**

```python
from backend.api.shift_slots import router as shift_slots_router
app.include_router(shift_slots_router)
```

**Step 5: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_api_shift_slots.py -v`
Expected: 全4テストPASS

**Step 6: コミット**

```bash
git add backend/
git commit -m "feat: add shift slots CRUD API with tests"
```

---

## Task 6: 必要人数設定API

**Files:**
- Create: `backend/backend/api/staffing_requirements.py`
- Create: `backend/tests/test_api_staffing_requirements.py`

**Step 1: テストを書く**

```python
def _create_shift_slot(client):
    res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    return res.json()["id"]


def test_create_staffing_requirement(client):
    slot_id = _create_shift_slot(client)
    response = client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 3},
    )
    assert response.status_code == 201
    assert response.json()["min_count"] == 3


def test_list_staffing_requirements(client):
    slot_id = _create_shift_slot(client)
    client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 3},
    )
    client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekend", "min_count": 2},
    )
    response = client.get("/api/staffing-requirements")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_staffing_requirement(client):
    slot_id = _create_shift_slot(client)
    res = client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 3},
    )
    req_id = res.json()["id"]
    response = client.put(
        f"/api/staffing-requirements/{req_id}", json={"min_count": 5}
    )
    assert response.status_code == 200
    assert response.json()["min_count"] == 5
```

**Step 2: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_api_staffing_requirements.py -v`
Expected: FAIL

**Step 3: staffing_requirements.pyを実装**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import StaffingRequirement
from backend.schemas import (
    StaffingRequirementCreate,
    StaffingRequirementResponse,
    StaffingRequirementUpdate,
)

router = APIRouter(prefix="/api/staffing-requirements", tags=["staffing-requirements"])


@router.get("", response_model=list[StaffingRequirementResponse])
def list_staffing_requirements(db: Session = Depends(get_db)):
    return db.query(StaffingRequirement).all()


@router.post("", response_model=StaffingRequirementResponse, status_code=201)
def create_staffing_requirement(
    data: StaffingRequirementCreate, db: Session = Depends(get_db)
):
    req = StaffingRequirement(**data.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.put("/{req_id}", response_model=StaffingRequirementResponse)
def update_staffing_requirement(
    req_id: int, data: StaffingRequirementUpdate, db: Session = Depends(get_db)
):
    req = db.query(StaffingRequirement).get(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Staffing requirement not found")
    req.min_count = data.min_count
    db.commit()
    db.refresh(req)
    return req
```

**Step 4: main.pyにルーターを登録**

```python
from backend.api.staffing_requirements import router as staffing_requirements_router
app.include_router(staffing_requirements_router)
```

**Step 5: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_api_staffing_requirements.py -v`
Expected: 全3テストPASS

**Step 6: コミット**

```bash
git add backend/
git commit -m "feat: add staffing requirements API with tests"
```

---

## Task 7: スタッフ希望API & スケジュール管理API

**Files:**
- Create: `backend/backend/api/requests.py`
- Create: `backend/backend/api/schedules.py`
- Create: `backend/tests/test_api_requests.py`
- Create: `backend/tests/test_api_schedules.py`

**Step 1: スタッフ希望APIのテストを書く**

```python
def _setup_data(client):
    staff_res = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    period_res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    return staff_res.json()["id"], slot_res.json()["id"], period_res.json()["id"]


def test_bulk_create_requests(client):
    staff_id, slot_id, period_id = _setup_data(client)
    response = client.post(
        "/api/requests",
        json={
            "period_id": period_id,
            "requests": [
                {
                    "staff_id": staff_id,
                    "date": "2026-03-01",
                    "shift_slot_id": slot_id,
                    "type": "preferred",
                },
                {
                    "staff_id": staff_id,
                    "date": "2026-03-02",
                    "shift_slot_id": None,
                    "type": "unavailable",
                },
            ],
        },
    )
    assert response.status_code == 201
    assert len(response.json()) == 2


def test_list_requests_by_period(client):
    staff_id, slot_id, period_id = _setup_data(client)
    client.post(
        "/api/requests",
        json={
            "period_id": period_id,
            "requests": [
                {
                    "staff_id": staff_id,
                    "date": "2026-03-01",
                    "type": "unavailable",
                },
            ],
        },
    )
    response = client.get(f"/api/requests?period_id={period_id}")
    assert response.status_code == 200
    assert len(response.json()) == 1
```

**Step 2: スケジュール管理APIのテストを書く**

```python
def test_create_schedule_period(client):
    response = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"


def test_get_schedule(client):
    res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    period_id = res.json()["id"]
    response = client.get(f"/api/schedules/{period_id}")
    assert response.status_code == 200
    assert response.json()["period"]["id"] == period_id
    assert response.json()["assignments"] == []


def test_publish_schedule(client):
    res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    period_id = res.json()["id"]
    response = client.put(f"/api/schedules/{period_id}/publish")
    assert response.status_code == 200
    assert response.json()["status"] == "published"
```

**Step 3: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_api_requests.py tests/test_api_schedules.py -v`
Expected: FAIL

**Step 4: requests.pyを実装**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import StaffRequest
from backend.schemas import StaffRequestBulkCreate, StaffRequestResponse

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("", response_model=list[StaffRequestResponse])
def list_requests(
    period_id: int = Query(...),
    staff_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    from backend.models import SchedulePeriod

    period = db.query(SchedulePeriod).get(period_id)
    query = db.query(StaffRequest).filter(
        StaffRequest.date >= period.start_date,
        StaffRequest.date <= period.end_date,
    )
    if staff_id is not None:
        query = query.filter(StaffRequest.staff_id == staff_id)
    return query.all()


@router.post("", response_model=list[StaffRequestResponse], status_code=201)
def bulk_create_requests(
    data: StaffRequestBulkCreate, db: Session = Depends(get_db)
):
    created = []
    for item in data.requests:
        req = StaffRequest(**item.model_dump())
        db.add(req)
        created.append(req)
    db.commit()
    for req in created:
        db.refresh(req)
    return created
```

**Step 5: schedules.pyを実装**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ScheduleAssignment, SchedulePeriod
from backend.schemas import (
    ScheduleAssignmentResponse,
    ScheduleAssignmentUpdate,
    SchedulePeriodCreate,
    SchedulePeriodResponse,
    ScheduleResponse,
)

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.post("", response_model=SchedulePeriodResponse, status_code=201)
def create_schedule_period(
    data: SchedulePeriodCreate, db: Session = Depends(get_db)
):
    period = SchedulePeriod(**data.model_dump())
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.get("/{period_id}", response_model=ScheduleResponse)
def get_schedule(period_id: int, db: Session = Depends(get_db)):
    period = db.query(SchedulePeriod).get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    assignments = (
        db.query(ScheduleAssignment)
        .filter(ScheduleAssignment.period_id == period_id)
        .all()
    )
    return ScheduleResponse(period=period, assignments=assignments)


@router.put(
    "/{period_id}/assignments/{assignment_id}",
    response_model=ScheduleAssignmentResponse,
)
def update_assignment(
    period_id: int,
    assignment_id: int,
    data: ScheduleAssignmentUpdate,
    db: Session = Depends(get_db),
):
    assignment = db.query(ScheduleAssignment).get(assignment_id)
    if not assignment or assignment.period_id != period_id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.shift_slot_id = data.shift_slot_id
    assignment.is_manual_edit = True
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/{period_id}/publish", response_model=SchedulePeriodResponse)
def publish_schedule(period_id: int, db: Session = Depends(get_db)):
    period = db.query(SchedulePeriod).get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    period.status = "published"
    db.commit()
    db.refresh(period)
    return period
```

**Step 6: main.pyにルーターを登録**

```python
from backend.api.requests import router as requests_router
from backend.api.schedules import router as schedules_router
app.include_router(requests_router)
app.include_router(schedules_router)
```

**Step 7: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_api_requests.py tests/test_api_schedules.py -v`
Expected: 全5テストPASS

**Step 8: コミット**

```bash
git add backend/
git commit -m "feat: add staff requests and schedule management APIs with tests"
```

---

## Task 8: 最適化エンジン

**Files:**
- Create: `backend/backend/optimizer/__init__.py`
- Create: `backend/backend/optimizer/solver.py`
- Create: `backend/tests/test_optimizer.py`

**Step 1: テストを書く**

```python
import pytest
from datetime import date, time

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    Staff,
    ShiftSlot,
    StaffRequest,
    SchedulePeriod,
    StaffingRequirement,
)
from backend.optimizer.solver import solve_schedule


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _setup_basic_scenario(db_session):
    """3人のスタッフ、1シフト枠、3日間、各日2人必要"""
    staff = [
        Staff(name="田中", role="一般", max_days_per_week=5),
        Staff(name="佐藤", role="一般", max_days_per_week=5),
        Staff(name="鈴木", role="一般", max_days_per_week=5),
    ]
    db_session.add_all(staff)

    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()

    req = StaffingRequirement(shift_slot_id=slot.id, day_type="weekday", min_count=2)
    db_session.add(req)

    period = SchedulePeriod(
        start_date=date(2026, 3, 2),  # Monday
        end_date=date(2026, 3, 4),    # Wednesday
        status="draft",
    )
    db_session.add(period)
    db_session.commit()

    return period


def test_basic_schedule_feasible(db_session):
    period = _setup_basic_scenario(db_session)
    result = solve_schedule(db_session, period.id)
    assert result["status"] == "optimal"
    assert len(result["assignments"]) > 0

    # 各日に2人以上割り当てられていることを確認
    from collections import Counter
    day_counts = Counter(a["date"] for a in result["assignments"])
    for d, count in day_counts.items():
        assert count >= 2


def test_unavailable_respected(db_session):
    period = _setup_basic_scenario(db_session)
    staff = db_session.query(Staff).filter_by(name="田中").first()

    # 田中は3/2が不可
    unavailable = StaffRequest(
        staff_id=staff.id,
        date=date(2026, 3, 2),
        shift_slot_id=None,
        type="unavailable",
    )
    db_session.add(unavailable)
    db_session.commit()

    result = solve_schedule(db_session, period.id)
    assert result["status"] == "optimal"

    # 田中が3/2に割り当てられていないことを確認
    for a in result["assignments"]:
        if a["staff_id"] == staff.id and a["date"] == "2026-03-02":
            pytest.fail("Unavailable staff was assigned")


def test_max_consecutive_days_respected(db_session):
    """7日間のスケジュールで連勤制限を確認"""
    staff = [
        Staff(name=f"スタッフ{i}", role="一般", max_days_per_week=5)
        for i in range(4)
    ]
    db_session.add_all(staff)

    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()

    req = StaffingRequirement(shift_slot_id=slot.id, day_type="weekday", min_count=2)
    db_session.add(req)

    period = SchedulePeriod(
        start_date=date(2026, 3, 2),   # Monday
        end_date=date(2026, 3, 8),     # Sunday (7 days)
        status="draft",
    )
    db_session.add(period)
    db_session.commit()

    result = solve_schedule(db_session, period.id, max_consecutive_days=5)
    assert result["status"] == "optimal"

    # 各スタッフが6連勤以上していないことを確認
    from collections import defaultdict
    staff_dates = defaultdict(set)
    for a in result["assignments"]:
        staff_dates[a["staff_id"]].add(a["date"])

    for s_id, dates in staff_dates.items():
        sorted_dates = sorted(dates)
        consecutive = 1
        for i in range(1, len(sorted_dates)):
            d1 = date.fromisoformat(sorted_dates[i - 1])
            d2 = date.fromisoformat(sorted_dates[i])
            if (d2 - d1).days == 1:
                consecutive += 1
                assert consecutive <= 5, f"Staff {s_id} has {consecutive} consecutive days"
            else:
                consecutive = 1
```

**Step 2: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_optimizer.py -v`
Expected: FAIL

**Step 3: solver.pyを実装**

```python
from datetime import date, timedelta
from collections import defaultdict

from pulp import LpMinimize, LpProblem, LpVariable, lpSum, SCIP_CMD, value
from sqlalchemy.orm import Session

from backend.models import (
    ScheduleAssignment,
    SchedulePeriod,
    ShiftSlot,
    Staff,
    StaffingRequirement,
    StaffRequest,
)


def _get_day_type(d: date) -> str:
    return "weekend" if d.weekday() >= 5 else "weekday"


def solve_schedule(
    db: Session,
    period_id: int,
    max_consecutive_days: int = 6,
    time_limit: int = 30,
) -> dict:
    period = db.query(SchedulePeriod).get(period_id)
    staff_list = db.query(Staff).all()
    slots = db.query(ShiftSlot).all()
    requirements = db.query(StaffingRequirement).all()
    requests = (
        db.query(StaffRequest)
        .filter(
            StaffRequest.date >= period.start_date,
            StaffRequest.date <= period.end_date,
        )
        .all()
    )

    # 日付リスト
    num_days = (period.end_date - period.start_date).days + 1
    dates = [period.start_date + timedelta(days=i) for i in range(num_days)]

    # 不可日マップ: (staff_id, date) -> True
    unavailable = set()
    for req in requests:
        if req.type == "unavailable":
            unavailable.add((req.staff_id, req.date))

    # 必要人数マップ: (slot_id, day_type) -> min_count
    req_map = {}
    for r in requirements:
        req_map[(r.shift_slot_id, r.day_type)] = r.min_count

    # --- PuLP モデル構築 ---
    prob = LpProblem("ShiftScheduling", LpMinimize)

    # 決定変数
    x = {}
    for s in staff_list:
        for d in dates:
            for t in slots:
                x[(s.id, d, t.id)] = LpVariable(
                    f"x_{s.id}_{d}_{t.id}", cat="Binary"
                )

    # 目的関数: 超過人数の最小化
    prob += lpSum(
        x[(s.id, d, t.id)]
        for s in staff_list
        for d in dates
        for t in slots
    ) - lpSum(
        req_map.get((t.id, _get_day_type(d)), 0)
        for d in dates
        for t in slots
    )

    # 制約1: 1日1シフト
    for s in staff_list:
        for d in dates:
            prob += lpSum(x[(s.id, d, t.id)] for t in slots) <= 1

    # 制約2: 必要人数確保
    for d in dates:
        for t in slots:
            min_count = req_map.get((t.id, _get_day_type(d)), 0)
            if min_count > 0:
                prob += (
                    lpSum(x[(s.id, d, t.id)] for s in staff_list) >= min_count
                )

    # 制約3: 不可日
    for s in staff_list:
        for d in dates:
            if (s.id, d) in unavailable:
                for t in slots:
                    prob += x[(s.id, d, t.id)] == 0

    # 制約4: 連勤制限
    for s in staff_list:
        for i in range(len(dates) - max_consecutive_days):
            window = dates[i : i + max_consecutive_days + 1]
            prob += (
                lpSum(x[(s.id, d, t.id)] for d in window for t in slots)
                <= max_consecutive_days
            )

    # 制約5: 週あたり勤務上限
    for s in staff_list:
        # 各週（月曜始まり）でグループ化
        weeks = defaultdict(list)
        for d in dates:
            week_start = d - timedelta(days=d.weekday())
            weeks[week_start].append(d)
        for week_start, week_dates in weeks.items():
            prob += (
                lpSum(x[(s.id, d, t.id)] for d in week_dates for t in slots)
                <= s.max_days_per_week
            )

    # 求解
    try:
        solver = SCIP_CMD(msg=0, timeLimit=time_limit)
    except Exception:
        # SCIPが見つからない場合はデフォルトソルバーにフォールバック
        solver = None

    prob.solve(solver)

    if prob.status != 1:
        return {
            "status": "infeasible",
            "message": "実行可能なシフトが見つかりませんでした。制約を緩和してください。",
            "assignments": [],
        }

    # 結果の抽出
    assignments = []
    for s in staff_list:
        for d in dates:
            for t in slots:
                if value(x[(s.id, d, t.id)]) > 0.5:
                    assignments.append(
                        {
                            "staff_id": s.id,
                            "date": d.isoformat(),
                            "shift_slot_id": t.id,
                        }
                    )

    return {
        "status": "optimal",
        "message": "最適なシフトが見つかりました。",
        "assignments": assignments,
    }
```

**Step 4: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_optimizer.py -v`
Expected: 全3テストPASS

**Step 5: コミット**

```bash
git add backend/
git commit -m "feat: add shift schedule optimizer with PuLP and SCIP"
```

---

## Task 9: 最適化APIエンドポイント

**Files:**
- Modify: `backend/backend/api/schedules.py`
- Create: `backend/tests/test_api_optimize.py`

**Step 1: テストを書く**

```python
def _setup_optimization_scenario(client):
    """最適化テスト用のデータをセットアップ"""
    # スタッフ3人
    for name in ["田中", "佐藤", "鈴木"]:
        client.post("/api/staff", json={"name": name, "role": "一般"})

    # シフト枠1つ
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = slot_res.json()["id"]

    # 必要人数
    client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 2},
    )

    # スケジュール期間（3日間・平日）
    period_res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-02", "end_date": "2026-03-04"},
    )
    return period_res.json()["id"]


def test_optimize_schedule(client):
    period_id = _setup_optimization_scenario(client)
    response = client.post(f"/api/schedules/{period_id}/optimize")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "optimal"
    assert len(data["assignments"]) > 0


def test_optimize_saves_assignments(client):
    period_id = _setup_optimization_scenario(client)
    client.post(f"/api/schedules/{period_id}/optimize")

    # シフト表を取得して割り当てがDBに保存されていることを確認
    response = client.get(f"/api/schedules/{period_id}")
    assert len(response.json()["assignments"]) > 0
```

**Step 2: テストが失敗することを確認**

Run: `cd backend && uv run pytest tests/test_api_optimize.py -v`
Expected: FAIL

**Step 3: schedules.pyに最適化エンドポイントを追加**

`schedules.py` に以下を追加:

```python
from backend.optimizer.solver import solve_schedule
from backend.schemas import OptimizeResponse


@router.post("/{period_id}/optimize", response_model=OptimizeResponse)
def optimize_schedule(period_id: int, db: Session = Depends(get_db)):
    period = db.query(SchedulePeriod).get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Schedule period not found")

    # 既存の自動生成結果を削除（手動編集は保持）
    db.query(ScheduleAssignment).filter(
        ScheduleAssignment.period_id == period_id,
        ScheduleAssignment.is_manual_edit == False,
    ).delete()
    db.commit()

    result = solve_schedule(db, period_id)

    if result["status"] == "optimal":
        for a in result["assignments"]:
            assignment = ScheduleAssignment(
                period_id=period_id,
                staff_id=a["staff_id"],
                date=a["date"],
                shift_slot_id=a["shift_slot_id"],
                is_manual_edit=False,
            )
            db.add(assignment)
        db.commit()

        # DB保存後のレスポンス用に再取得
        saved = (
            db.query(ScheduleAssignment)
            .filter(ScheduleAssignment.period_id == period_id)
            .all()
        )
        return OptimizeResponse(
            status=result["status"],
            message=result["message"],
            assignments=saved,
        )

    return OptimizeResponse(
        status=result["status"],
        message=result["message"],
        assignments=[],
    )
```

**Step 4: テストが通ることを確認**

Run: `cd backend && uv run pytest tests/test_api_optimize.py -v`
Expected: 全2テストPASS

**Step 5: 全テストが通ることを確認**

Run: `cd backend && uv run pytest -v`
Expected: 全テストPASS

**Step 6: コミット**

```bash
git add backend/
git commit -m "feat: add optimization endpoint to schedule API"
```

---

## Task 10: フロントエンド プロジェクト初期化

**Files:**
- Create: `frontend/` (Next.js project via create-next-app)

**Step 1: Next.jsプロジェクトを作成**

Run:
```bash
npx create-next-app@latest frontend \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias="@/*" --no-turbopack
```

**Step 2: shadcn/uiをセットアップ**

Run:
```bash
cd frontend && npx shadcn@latest init -d
```

**Step 3: 必要なshadcn/uiコンポーネントをインストール**

Run:
```bash
cd frontend && npx shadcn@latest add button table input select dialog card
```

**Step 4: API呼び出し用ユーティリティを作成**

Create: `frontend/lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
```

**Step 5: 動作確認**

Run: `cd frontend && npm run dev`
ブラウザで `http://localhost:3000` にアクセスし、Next.jsのデフォルトページが表示されることを確認。

**Step 6: コミット**

```bash
git add frontend/
git commit -m "chore: initialize frontend with Next.js, Tailwind, and shadcn/ui"
```

---

## Task 11: 設定画面（スタッフ管理）

**Files:**
- Create: `frontend/app/settings/page.tsx`
- Create: `frontend/components/staff-table.tsx`
- Create: `frontend/lib/types.ts`

**Step 1: 型定義を作成**

Create: `frontend/lib/types.ts`

```typescript
export interface Staff {
  id: number;
  name: string;
  role: string;
  max_days_per_week: number;
}

export interface ShiftSlot {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

export interface StaffingRequirement {
  id: number;
  shift_slot_id: number;
  day_type: string;
  min_count: number;
}

export interface StaffRequest {
  id: number;
  staff_id: number;
  date: string;
  shift_slot_id: number | null;
  type: "preferred" | "unavailable";
}

export interface SchedulePeriod {
  id: number;
  start_date: string;
  end_date: string;
  status: "draft" | "published";
}

export interface ScheduleAssignment {
  id: number;
  period_id: number;
  staff_id: number;
  date: string;
  shift_slot_id: number | null;
  is_manual_edit: boolean;
}

export interface ScheduleResponse {
  period: SchedulePeriod;
  assignments: ScheduleAssignment[];
}

export interface OptimizeResponse {
  status: string;
  message: string;
  assignments: ScheduleAssignment[];
}
```

**Step 2: スタッフ管理テーブルコンポーネントを作成**

Create: `frontend/components/staff-table.tsx`

スタッフ一覧テーブルを表示。追加・編集・削除のダイアログ付き。`/api/staff` を呼び出す。shadcn/uiのTable, Button, Dialog, Inputコンポーネントを使用。

**Step 3: 設定画面を作成**

Create: `frontend/app/settings/page.tsx`

タブまたはセクション分けで以下を表示:
- スタッフ管理セクション（StaffTableコンポーネント）
- シフト枠管理セクション（同様のテーブル）
- 必要人数設定セクション（シフト枠×曜日タイプのマトリクス）

**Step 4: 動作確認**

バックエンドとフロントエンドを両方起動し、`http://localhost:3000/settings` でスタッフのCRUD操作ができることを確認。

**Step 5: コミット**

```bash
git add frontend/
git commit -m "feat: add settings page with staff, shift slots, and requirements management"
```

---

## Task 12: シフト表画面

**Files:**
- Create: `frontend/app/schedule/page.tsx`
- Create: `frontend/components/shift-calendar.tsx`

**Step 1: シフトカレンダーコンポーネントを作成**

Create: `frontend/components/shift-calendar.tsx`

グリッド表示（横軸: 日付、縦軸: スタッフ）。各セルにシフト枠名を色付きで表示。手動編集セルは背景色で区別。セルクリックでシフト枠を選択変更可能。

**Step 2: スケジュール画面を作成**

Create: `frontend/app/schedule/page.tsx`

- 期間選択/作成UI
- ShiftCalendarコンポーネント
- 「最適化実行」ボタン → `/api/schedules/{id}/optimize` を呼び出し
- 「公開」ボタン → `/api/schedules/{id}/publish` を呼び出し
- ローディング表示（最適化実行中）

**Step 3: 動作確認**

バックエンドとフロントエンドを両方起動。設定画面でスタッフ・シフト枠・必要人数を登録後、シフト表画面で期間を作成し、最適化を実行してシフト表が表示されることを確認。手動編集も動作確認。

**Step 4: コミット**

```bash
git add frontend/
git commit -m "feat: add schedule page with shift calendar and optimization"
```

---

## Task 13: スタッフ希望入力画面

**Files:**
- Create: `frontend/app/staff/page.tsx`
- Create: `frontend/components/request-calendar.tsx`

**Step 1: 希望入力カレンダーコンポーネントを作成**

Create: `frontend/components/request-calendar.tsx`

カレンダー表示。日付をクリックすると「希望シフト」「休み希望」「不可」を選択できるポップオーバー。送信済みの希望は色分け表示（希望=青、不可=赤）。

**Step 2: スタッフ画面を作成**

Create: `frontend/app/staff/page.tsx`

- URLパラメータからスタッフIDを取得（`?id=3`）
- スタッフ名を表示
- RequestCalendarコンポーネント（期間を指定して希望入力）
- 公開済みシフト表の閲覧セクション

**Step 3: 動作確認**

`http://localhost:3000/staff?id=1` にアクセスし、カレンダーで希望を入力・保存できることを確認。

**Step 4: コミット**

```bash
git add frontend/
git commit -m "feat: add staff request input page with calendar"
```

---

## Task 14: ナビゲーションとレイアウト

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`

**Step 1: レイアウトにナビゲーションを追加**

`layout.tsx` にヘッダーナビを追加:
- 「シフト表」→ `/schedule`
- 「設定」→ `/settings`
- 「希望入力」→ `/staff`

**Step 2: トップページからリダイレクト**

`page.tsx` で `/schedule` にリダイレクト。

**Step 3: 動作確認**

各ページ間のナビゲーションが正常に動作することを確認。

**Step 4: コミット**

```bash
git add frontend/
git commit -m "feat: add navigation layout and root redirect"
```

---

## Task 15: 結合テストと最終確認

**Step 1: バックエンド全テスト実行**

Run: `cd backend && uv run pytest -v`
Expected: 全テストPASS

**Step 2: エンドツーエンド動作確認**

1. バックエンド起動: `cd backend && uv run uvicorn backend.main:app --reload --port 8000`
2. フロントエンド起動: `cd frontend && npm run dev`
3. 設定画面でスタッフ3人、シフト枠2つ（早番・遅番）、必要人数を登録
4. スタッフ希望入力画面で希望・不可を入力
5. シフト表画面で期間作成→最適化実行→シフト表確認
6. 手動編集してセルの色が変わることを確認
7. 公開ボタンを押して状態が変わることを確認

**Step 3: コミット**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
