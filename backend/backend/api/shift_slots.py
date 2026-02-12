from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import ShiftSlotRepository
from backend.schemas import ShiftSlotCreate, ShiftSlotResponse, ShiftSlotUpdate

router = APIRouter(prefix="/api/shift-slots", tags=["shift-slots"])


@router.get("", response_model=list[ShiftSlotResponse])
def list_shift_slots(db: Session = Depends(get_db)):
    repo = ShiftSlotRepository(db)
    return repo.list_all()


@router.post("", response_model=ShiftSlotResponse, status_code=201)
def create_shift_slot(data: ShiftSlotCreate, db: Session = Depends(get_db)):
    repo = ShiftSlotRepository(db)
    return repo.create(**data.model_dump())


@router.put("/{slot_id}", response_model=ShiftSlotResponse)
def update_shift_slot(
    slot_id: int, data: ShiftSlotUpdate, db: Session = Depends(get_db)
):
    repo = ShiftSlotRepository(db)
    result = repo.update(slot_id, **data.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    return result


@router.delete("/{slot_id}", status_code=204)
def delete_shift_slot(slot_id: int, db: Session = Depends(get_db)):
    repo = ShiftSlotRepository(db)
    if not repo.delete(slot_id):
        raise HTTPException(status_code=404, detail="Shift slot not found")
