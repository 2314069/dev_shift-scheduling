from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import models  # noqa: F401
from backend.api.requests import router as requests_router
from backend.api.schedules import router as schedules_router
from backend.api.shift_slots import router as shift_slots_router
from backend.api.staff import router as staff_router
from backend.api.staffing_requirements import router as staffing_requirements_router
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


app.include_router(staff_router)
app.include_router(shift_slots_router)
app.include_router(staffing_requirements_router)
app.include_router(requests_router)
app.include_router(schedules_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
