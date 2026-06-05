import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import ActualGeneration, ForecastAccuracy, ForecastRun, ForecastValue


def _actual_metric(row: ActualGeneration) -> float:
    return row.actual_energy_kwh if row.actual_energy_kwh is not None else row.actual_power_kw


def _forecast_metric(row: ForecastValue) -> float:
    return row.predicted_energy_kwh if row.predicted_energy_kwh is not None else row.predicted_power_kw


async def calculate_accuracy_for_run(
    session: AsyncSession,
    forecast_run_id: uuid.UUID,
) -> ForecastAccuracy:
    forecast_run = await session.get(ForecastRun, forecast_run_id)
    if forecast_run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Forecast run not found",
        )

    result = await session.execute(
        select(ForecastValue, ActualGeneration)
        .join(
            ActualGeneration,
            (ActualGeneration.solar_plant_id == ForecastValue.solar_plant_id)
            & (ActualGeneration.timestamp == ForecastValue.timestamp),
        )
        .where(ForecastValue.forecast_run_id == forecast_run_id)
        .order_by(ForecastValue.timestamp)
    )
    matched_rows = result.all()

    if not matched_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No matching forecast and actual generation points found",
        )

    errors: list[float] = []
    squared_errors: list[float] = []
    percentage_errors: list[float] = []
    biases: list[float] = []
    timestamps = []

    for forecast_value, actual_value in matched_rows:
        actual = _actual_metric(actual_value)
        forecast = _forecast_metric(forecast_value)
        error = actual - forecast

        errors.append(abs(error))
        squared_errors.append(error * error)
        biases.append(error)
        timestamps.append(forecast_value.timestamp)

        if actual != 0:
            percentage_errors.append(abs(error / actual) * 100)

    mae = sum(errors) / len(errors)
    rmse = math.sqrt(sum(squared_errors) / len(squared_errors))
    bias = sum(biases) / len(biases)
    mape = (
        sum(percentage_errors) / len(percentage_errors)
        if percentage_errors
        else None
    )

    existing_result = await session.execute(
        select(ForecastAccuracy).where(ForecastAccuracy.forecast_run_id == forecast_run_id)
    )
    accuracy = existing_result.scalar_one_or_none()

    if accuracy is None:
        accuracy = ForecastAccuracy(
            forecast_run_id=forecast_run.id,
            solar_plant_id=forecast_run.solar_plant_id,
            period_start=min(timestamps),
            period_end=max(timestamps),
            mape=mape,
            rmse=rmse,
            mae=mae,
            bias=bias,
            samples_count=len(matched_rows),
        )
        session.add(accuracy)
    else:
        accuracy.period_start = min(timestamps)
        accuracy.period_end = max(timestamps)
        accuracy.mape = mape
        accuracy.rmse = rmse
        accuracy.mae = mae
        accuracy.bias = bias
        accuracy.samples_count = len(matched_rows)

    await session.commit()
    await session.refresh(accuracy)
    return accuracy
