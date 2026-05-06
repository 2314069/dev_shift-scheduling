import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import models  # noqa: F401
from backend.api.fairness import router as fairness_router
from backend.api.internal_auth import router as internal_auth_router
from backend.api.me import router as me_router
from backend.api.organizations import router as organizations_router
from backend.api.requests import router as requests_router
from backend.api.role_staffing_requirements import (
    router as role_staffing_requirements_router,
)
from backend.api.schedules import router as schedules_router
from backend.api.shift_slots import router as shift_slots_router
from backend.api.skill_requirements import router as skill_requirements_router
from backend.api.skills import router as skills_router
from backend.api.solver_config import router as solver_config_router
from backend.api.staff import router as staff_router
from backend.api.staffing_requirements import router as staffing_requirements_router
from backend.database import apply_migrations, engine
from backend.logging_config import configure_logging

# ログマスキングを最初に適用する（個人情報保護・Phase 1-6）。
# apply_migrations より前に呼ぶことで、マイグレーションログも保護対象にする。
configure_logging()

# Alembic ベースのマイグレーションを適用（AUTO_MIGRATE=0 で無効化可能）。
# Base.metadata.create_all は alembic に置き換えたため呼び出さない。
apply_migrations(engine)

app = FastAPI(title="Shift Scheduling API")

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
_allow_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(staff_router)
app.include_router(shift_slots_router)
app.include_router(staffing_requirements_router)
app.include_router(requests_router)
app.include_router(schedules_router)
app.include_router(solver_config_router)
app.include_router(role_staffing_requirements_router)
app.include_router(skills_router)
app.include_router(skill_requirements_router)
app.include_router(fairness_router)
app.include_router(internal_auth_router)
app.include_router(organizations_router)
app.include_router(me_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
