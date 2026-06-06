import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import ValidationError

from app.models.forecast import SolarPlant
from app.schemas.telemetry import ActualGenerationTelemetryPayload, RejectedTelemetryReason

POWER_CAPACITY_TOLERANCE = 1.10
FUTURE_TIMESTAMP_TOLERANCE = timedelta(minutes=5)
STALE_TIMESTAMP_LIMIT = timedelta(days=30)


@dataclass
class TelemetryRejection(Exception):
    reason: RejectedTelemetryReason
    error_message: str
    plant_id: uuid.UUID | None = None
    raw_payload_json: dict[str, Any] | list[Any] | None = None
    metadata: dict[str, Any] | None = None


def decode_payload(payload: bytes) -> str:
    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_json,
            error_message="Payload is not valid UTF-8",
        ) from exc


def parse_topic(topic: str) -> uuid.UUID:
    parts = topic.split("/")
    if len(parts) != 4 or parts[0] != "plants" or parts[2:] != ["generation", "actual"]:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_topic,
            error_message="Topic must match plants/{plant_id}/generation/actual",
            metadata={"topic_parts": parts},
        )

    try:
        return uuid.UUID(parts[1])
    except ValueError as exc:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_plant_id,
            error_message="plant_id in MQTT topic is not a valid UUID",
        ) from exc


def parse_payload(raw_payload_text: str, plant_id: uuid.UUID | None = None) -> dict[str, Any] | list[Any]:
    try:
        parsed = json.loads(raw_payload_text)
    except json.JSONDecodeError as exc:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_json,
            error_message=str(exc),
            plant_id=plant_id,
        ) from exc

    if not isinstance(parsed, dict):
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_json,
            error_message="Payload must be a JSON object",
            plant_id=plant_id,
            raw_payload_json=parsed,
        )

    return parsed


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def validate_payload_shape(
    payload_json: dict[str, Any],
    plant_id: uuid.UUID,
) -> ActualGenerationTelemetryPayload:
    if not isinstance(payload_json.get("timestamp"), str):
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_timestamp,
            error_message="timestamp must be an ISO 8601 string",
            plant_id=plant_id,
            raw_payload_json=payload_json,
        )

    try:
        payload = ActualGenerationTelemetryPayload.model_validate(payload_json)
    except ValidationError as exc:
        errors = exc.errors()
        first_error = errors[0] if errors else {}
        field = first_error.get("loc", [None])[0]
        reason = (
            RejectedTelemetryReason.invalid_timestamp
            if field == "timestamp"
            else RejectedTelemetryReason.unknown_error
        )
        raise TelemetryRejection(
            reason=reason,
            error_message=str(exc),
            plant_id=plant_id,
            raw_payload_json=payload_json,
        ) from exc

    payload.timestamp = _as_utc(payload.timestamp)
    timestamp = payload.timestamp
    now = datetime.now(timezone.utc)

    if timestamp.minute % 15 != 0 or timestamp.second != 0 or timestamp.microsecond != 0:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.invalid_timestamp,
            error_message="timestamp must be aligned to a 15-minute interval",
            plant_id=plant_id,
            raw_payload_json=payload_json,
        )

    if timestamp > now + FUTURE_TIMESTAMP_TOLERANCE:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.future_timestamp,
            error_message="timestamp is too far in the future",
            plant_id=plant_id,
            raw_payload_json=payload_json,
        )

    if timestamp < now - STALE_TIMESTAMP_LIMIT:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.stale_timestamp,
            error_message="timestamp is older than 30 days",
            plant_id=plant_id,
            raw_payload_json=payload_json,
        )

    if payload.actual_power_kw < 0:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.negative_power,
            error_message="actual_power_kw must be greater than or equal to 0",
            plant_id=plant_id,
            raw_payload_json=payload_json,
        )

    if payload.actual_energy_kwh is not None and payload.actual_energy_kwh < 0:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.negative_energy,
            error_message="actual_energy_kwh must be greater than or equal to 0",
            plant_id=plant_id,
            raw_payload_json=payload_json,
        )

    return payload


def validate_against_plant_capacity(
    payload: ActualGenerationTelemetryPayload,
    plant: SolarPlant,
    payload_json: dict[str, Any],
) -> None:
    max_power_kw = plant.capacity_kw * POWER_CAPACITY_TOLERANCE
    if payload.actual_power_kw > max_power_kw:
        raise TelemetryRejection(
            reason=RejectedTelemetryReason.power_exceeds_capacity,
            error_message="actual_power_kw exceeds solar plant capacity tolerance",
            plant_id=plant.id,
            raw_payload_json=payload_json,
            metadata={
                "capacity_kw": plant.capacity_kw,
                "max_power_kw": max_power_kw,
                "actual_power_kw": payload.actual_power_kw,
            },
        )
