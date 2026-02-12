from sqlalchemy.orm import Session

from backend.domain import SolverConfig
from backend.models import SolverConfigModel


class SolverConfigRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(model: SolverConfigModel) -> SolverConfig:
        return SolverConfig(
            id=model.id,
            max_consecutive_days=model.max_consecutive_days,
            time_limit=model.time_limit,
            min_shift_interval_hours=model.min_shift_interval_hours,
            enable_preferred_shift=model.enable_preferred_shift,
            enable_fairness=model.enable_fairness,
            enable_weekend_fairness=model.enable_weekend_fairness,
            enable_shift_interval=model.enable_shift_interval,
            enable_role_staffing=model.enable_role_staffing,
            enable_min_days_per_week=model.enable_min_days_per_week,
            enable_soft_staffing=model.enable_soft_staffing,
            weight_preferred=model.weight_preferred,
            weight_fairness=model.weight_fairness,
            weight_weekend_fairness=model.weight_weekend_fairness,
            weight_soft_staffing=model.weight_soft_staffing,
        )

    def get_or_create_default(self) -> SolverConfig:
        model = self.db.get(SolverConfigModel, 1)
        if model is None:
            model = SolverConfigModel(id=1)
            self.db.add(model)
            self.db.commit()
            self.db.refresh(model)
        return self._to_domain(model)

    def update(self, **kwargs) -> SolverConfig:
        model = self.db.get(SolverConfigModel, 1)
        if model is None:
            model = SolverConfigModel(id=1)
            self.db.add(model)
            self.db.commit()
            self.db.refresh(model)
        for key, value in kwargs.items():
            setattr(model, key, value)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def reset(self) -> SolverConfig:
        model = self.db.get(SolverConfigModel, 1)
        if model:
            self.db.delete(model)
            self.db.commit()
        model = SolverConfigModel(id=1)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)
