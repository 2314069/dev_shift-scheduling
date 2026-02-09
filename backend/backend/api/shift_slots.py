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
    slot = db.get(ShiftSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(slot, key, value)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_shift_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.get(ShiftSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    db.delete(slot)
    db.commit()
