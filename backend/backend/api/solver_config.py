from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import get_current_org_id
from backend.database import get_db
from backend.repositories import SolverConfigRepository
from backend.schemas import SolverConfigResponse, SolverConfigUpdate

router = APIRouter(prefix="/api/solver-config", tags=["solver-config"])


@router.get("", response_model=SolverConfigResponse)
def get_solver_config(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = SolverConfigRepository(db)
    return repo.get_or_create(org_id)


@router.put("", response_model=SolverConfigResponse)
def update_solver_config(
    data: SolverConfigUpdate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = SolverConfigRepository(db)
    repo.get_or_create(org_id)
    return repo.update(org_id, **data.model_dump(exclude_unset=True))


@router.post("/reset", response_model=SolverConfigResponse)
def reset_solver_config(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = SolverConfigRepository(db)
    return repo.reset(org_id)
