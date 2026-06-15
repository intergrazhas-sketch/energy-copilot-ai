import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AlertSeverity(StrEnum):
    healthy = "healthy"
    warning = "warning"
    critical = "critical"
    unknown = "unknown"


class AlertRead(BaseModel):
    id: str
    type: str
    severity: AlertSeverity
    title: str
    message: str
    source: str
    plant_id: uuid.UUID | None = None
    detected_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class AlertsSummary(BaseModel):
    generated_at: datetime
    total: int
    active_alerts: int
    healthy: int
    warning: int
    critical: int
    unknown: int
    alerts: list[AlertRead]
