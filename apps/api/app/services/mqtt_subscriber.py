import asyncio
import logging

import aiomqtt
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings, get_settings
from app.db.session import async_session_factory
from app.repositories import forecast as forecast_repository
from app.repositories.telemetry import create_rejected_telemetry
from app.schemas.telemetry import RejectedTelemetryReason
from app.services.actual_generation import ingest_actual_generation_point
from app.services.telemetry_quality import (
    TelemetryRejection,
    decode_payload,
    parse_payload,
    parse_topic,
    validate_against_plant_capacity,
    validate_payload_shape,
)

logger = logging.getLogger(__name__)


async def _save_rejected_message(
    *,
    topic: str,
    raw_payload_text: str,
    rejection: TelemetryRejection,
) -> None:
    async with async_session_factory() as session:
        try:
            await create_rejected_telemetry(
                session,
                source="mqtt",
                topic=topic,
                plant_id=rejection.plant_id,
                reason=rejection.reason.value,
                error_message=rejection.error_message,
                raw_payload_text=raw_payload_text,
                raw_payload_json=rejection.raw_payload_json,
                metadata=rejection.metadata,
            )
        except Exception:
            logger.exception("Failed to save rejected telemetry", extra={"topic": topic})


async def _reject_message(
    *,
    topic: str,
    raw_payload_text: str,
    rejection: TelemetryRejection,
) -> None:
    await _save_rejected_message(
        topic=topic,
        raw_payload_text=raw_payload_text,
        rejection=rejection,
    )
    logger.warning(
        "Rejected actual generation MQTT message",
        extra={
            "topic": topic,
            "plant_id": str(rejection.plant_id) if rejection.plant_id else None,
            "reason": rejection.reason.value,
        },
    )


async def _handle_message(topic: str, payload: bytes) -> None:
    try:
        raw_payload_text = decode_payload(payload)
    except TelemetryRejection as rejection:
        await _reject_message(topic=topic, raw_payload_text="<invalid utf-8 payload>", rejection=rejection)
        return

    async with async_session_factory() as session:
        try:
            plant_id = parse_topic(topic)
            payload_json = parse_payload(raw_payload_text, plant_id)
            telemetry = validate_payload_shape(payload_json, plant_id)

            plant = await forecast_repository.get_solar_plant(session, plant_id)
            if plant is None:
                raise TelemetryRejection(
                    reason=RejectedTelemetryReason.plant_not_found,
                    error_message="Solar plant not found",
                    plant_id=plant_id,
                    raw_payload_json=payload_json,
                )

            validate_against_plant_capacity(telemetry, plant, payload_json)
            recalculated_run_ids, recalculated_count = await ingest_actual_generation_point(
                session,
                solar_plant_id=plant_id,
                payload=telemetry,
            )
            logger.info(
                "Actual generation ingested from MQTT",
                extra={
                    "plant_id": str(plant_id),
                    "timestamp": telemetry.timestamp.isoformat(),
                    "recalculated_count": recalculated_count,
                    "recalculated_run_ids": [str(run_id) for run_id in recalculated_run_ids],
                },
            )
        except TelemetryRejection as rejection:
            await _reject_message(
                topic=topic,
                raw_payload_text=raw_payload_text,
                rejection=rejection,
            )
        except SQLAlchemyError as exc:
            await _reject_message(
                topic=topic,
                raw_payload_text=raw_payload_text,
                rejection=TelemetryRejection(
                    reason=RejectedTelemetryReason.db_error,
                    error_message=str(exc),
                ),
            )
        except Exception:
            logger.exception("Failed to ingest actual generation from MQTT", extra={"topic": topic})
            await _reject_message(
                topic=topic,
                raw_payload_text=raw_payload_text,
                rejection=TelemetryRejection(
                    reason=RejectedTelemetryReason.unknown_error,
                    error_message="Unexpected ingestion error",
                ),
            )


async def mqtt_subscriber_loop(settings: Settings | None = None) -> None:
    current_settings = settings or get_settings()

    if not current_settings.mqtt_enabled:
        logger.info("MQTT subscriber disabled")
        return

    while True:
        try:
            async with aiomqtt.Client(
                hostname=current_settings.mqtt_host,
                port=current_settings.mqtt_port,
                username=current_settings.mqtt_user,
                password=current_settings.mqtt_password,
            ) as client:
                await client.subscribe(current_settings.mqtt_actual_topic)
                logger.info("MQTT subscriber connected", extra={"topic": current_settings.mqtt_actual_topic})

                async for message in client.messages:
                    await _handle_message(str(message.topic), message.payload)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "MQTT subscriber disconnected; reconnecting",
                extra={"reconnect_seconds": current_settings.mqtt_reconnect_seconds},
            )
            await asyncio.sleep(current_settings.mqtt_reconnect_seconds)


def start_mqtt_subscriber(settings: Settings | None = None) -> asyncio.Task[None]:
    return asyncio.create_task(mqtt_subscriber_loop(settings))


async def stop_mqtt_subscriber(task: asyncio.Task[None] | None) -> None:
    if task is None:
        return

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        logger.info("MQTT subscriber stopped")
