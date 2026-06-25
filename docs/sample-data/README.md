# Sample data for import / Шаблонные данные для импорта / Импорт үшін үлгі деректер

## RU
Это **шаблонные (demo) файлы** для проверки импорта данных в Energy Copilot.
Здесь нет реальных коммерческих данных — только тестовые значения, похожие на
солнечную станцию. Используйте их, чтобы проверить CSV/Excel import и показать
специалисту нужный формат.

Реальные файлы должны содержать колонку `timestamp` (дата-время, интервал 15 минут)
и значения генерации или метео. Названия колонок нормализуются автоматически
(пробелы → `_`, нижний регистр), поддерживаются синонимы (`datetime`, `power_kw`,
`actual`, `forecast`, `energy` и т.д.).

Файлы:
- `sample_forecast_generation.xlsx` — прогноз генерации: `timestamp`,
  `forecast_power_kw`, `forecast_energy_kwh`, `provider_code`.
- `sample_actual_generation.xlsx` — фактическая генерация: `timestamp`,
  `actual_power_kw`, `actual_energy_kwh`.
- `sample_weather_station.xlsx` — выгрузка метеостанции: `timestamp`,
  `irradiance_w_m2`, `temperature_c`, `wind_speed_m_s`, `humidity_percent`.
- `test_station_telemetry.csv`, `test_forecast_runs.csv` — прежние CSV-примеры.

Примечание по прогнозу: в шаблоне `provider_code = manual_excel_forecast`.
Текущий endpoint `/api/v1/forecast-runs/import-csv` принимает только
`manual_csv_forecast` (или пустой `provider_code`). Чтобы импортировать этот
шаблон как есть, нужен отдельный маленький шаг — разрешить код
`manual_excel_forecast` на бэкенде. Метеоданные пока не имеют отдельного
endpoint — файл предназначен для проверки чтения и согласования формата.

## EN
These are **template (demo) files** for testing data import into Energy Copilot.
They contain no real commercial data — only sample values resembling a solar
plant. Use them to test CSV/Excel import and to show the required format.

Real files must include a `timestamp` column (date-time, 15-minute interval) and
generation or weather values. Column names are normalized automatically (spaces →
`_`, lower-case) and common aliases are accepted.

Files:
- `sample_forecast_generation.xlsx` — forecast generation.
- `sample_actual_generation.xlsx` — actual generation report.
- `sample_weather_station.xlsx` — weather station export.

Note: the forecast template uses `provider_code = manual_excel_forecast`. The
current endpoint accepts only `manual_csv_forecast` (or an empty `provider_code`),
so importing this template as-is needs a small backend follow-up. Weather data has
no dedicated endpoint yet.

## KZ
Бұл — Energy Copilot импортын тексеруге арналған **үлгі (demo) файлдар**.
Нақты коммерциялық деректер жоқ, тек күн станциясына ұқсас сынақ мәндері.
Оларды CSV/Excel импортын тексеру және қажетті форматты көрсету үшін қолданыңыз.

Нақты файлдарда `timestamp` бағаны (күн-уақыт, 15 минут аралығы) және генерация
немесе метео мәндері болуы керек. Баған атаулары автоматты түрде қалыпқа келтіріледі
(бос орын → `_`, кіші әріп), синонимдер қолдау табады.

Файлдар:
- `sample_forecast_generation.xlsx` — генерация болжамы.
- `sample_actual_generation.xlsx` — нақты генерация есебі.
- `sample_weather_station.xlsx` — метеостанция экспорты.

Ескерту: болжам үлгісінде `provider_code = manual_excel_forecast`. Ағымдағы
endpoint тек `manual_csv_forecast` (немесе бос `provider_code`) қабылдайды, сондықтан
бұл үлгіні импорттау үшін шағын backend қадамы қажет. Метео деректер үшін әзірге
жеке endpoint жоқ.
