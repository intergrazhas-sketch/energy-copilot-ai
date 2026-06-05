import asyncio
import json
import logging
import uuid

import aiomqtt
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.db.session import async_session_factory
from app.schemas.telemetry import ActualGenerationTelemetryPayload
from app.services.actual_generation import ingest_actual_generation_point

logger = logging.getLogger(__name__)


def _extract_plant_id(topic: str) -> uuid.UUID:
    parts = topic.split("/")
    if len(parts) != 4 or parts[0] != "plants" or parts[2:] != ["generation", "actual"]:
        raise ValueError("Unsupported MQTT topic")
    return uuid.UUID(parts[1])


async def _handle_message(topic: str, payload: bytes) -> None:
    try:
        plant_id = _extract_plant_id(topic)
        data = json.loads(payload.decode("utf-8"))
        telemetry = ActualGenerationTelemetryPayload.model_validate(data)
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError, ValidationError):
        logger.exception("Invalid actual generation MQTT message", extra={"topic": topic})
        return

    async with async_session_factory() as session:
        try:
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
        except Exception:
            logger.exception("Failed to ingest actual generation from MQTT", extra={"topic": topic})


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
