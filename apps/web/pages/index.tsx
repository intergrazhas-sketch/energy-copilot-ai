import { useEffect, useMemo, useState } from "react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "../messages/en.json";
import kzMessages from "../messages/kz.json";
import ruMessages from "../messages/ru.json";

type HealthResponse = {
  status?: string;
  service?: string;
  version?: string;
  environment?: string;
};

type DependencyStatus = {
  status?: string;
  latency_ms?: number;
  message?: string;
};

type SystemStatusResponse = HealthResponse & {
  dependencies?: Record<string, DependencyStatus>;
};

type SolarPlant = {
  id: string;
  name: string;
  capacity_kw: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string;
  created_at?: string;
};

type SolarPlantFormState = {
  name: string;
  capacityKw: string;
  latitude: string;
  longitude: string;
  timezone: string;
  status: string;
};

type ForecastProvider = {
  id: string;
  code: string;
  name: string;
  provider_type: string;
  status: string;
  data_status: string;
  latest_forecast_at?: string | null;
  latest_accuracy_mape?: number | null;
  baseline_mape?: number | null;
  target_mape: number;
  notes: string;
  recommended_action: string;
  forecast_runs_count: number;
  is_active?: boolean;
};

type ForecastRun = {
  id: string;
  solar_plant_id: string;
  provider_id: string;
  run_at: string;
  horizon_hours: number;
  interval_minutes: number;
  status: string;
  created_at: string;
};

type AccuracySummary = {
  providers_count: number;
  solar_plants_count: number;
  aggregates_count: number;
  forecast_runs_count: number;
  samples_count: number;
  avg_mape: number | null;
  avg_rmse: number | null;
  avg_mae: number | null;
  avg_bias: number | null;
};

type AccuracyProviderRankingItem = {
  provider_id: string;
  provider_code: string;
  provider_name: string;
  avg_mape: number | null;
  avg_rmse: number | null;
  avg_mae: number | null;
  avg_bias: number | null;
  forecast_runs_count: number;
  samples_count: number;
  rank: number;
};

type AccuracyProviderRankingResponse = {
  bucket_type: string;
  period_from: string;
  period_to: string;
  solar_plant_id?: string | null;
  providers: AccuracyProviderRankingItem[];
};

type RejectedTelemetrySummary = {
  total: number;
  items: Array<{
    reason: string;
    count: number;
  }>;
};

type RejectedTelemetryRecord = {
  id: string;
  source: string;
  topic: string;
  plant_id: string | null;
  reason: string;
  error_message: string;
  raw_payload_text: string;
  raw_payload_json: unknown;
  received_at: string;
  resolved_at: string | null;
  resolution_status: string;
  metadata?: unknown;
};

type TelemetryPoint = {
  id: string;
  asset_id: string;
  timestamp: string;
  actual_power_kw: number;
  actual_energy_kwh: number | null;
  source: string;
  quality: string;
  created_at: string;
};

type TelemetrySummary = {
  asset_id: string;
  period_from: string;
  period_to: string;
  current_power_kw: number | null;
  energy_today_kwh: number | null;
  avg_power_kw: number | null;
  max_power_kw: number | null;
  telemetry_points_count: number;
  last_telemetry_time: string | null;
  data_freshness_status: "fresh" | "stale" | "offline" | "no_data";
  estimated_revenue_today: number | null;
  possible_data_gap_minutes: number | null;
};

type TelemetryCsvImportResponse = {
  imported_rows: number;
  rejected_rows: number;
  errors: Array<{
    row_number: number | null;
    message: string;
  }>;
};

type LastCsvImportSummary = {
  fileName: string;
  importedRows: number;
  rejectedRows: number;
  importedAt: string;
  plantId?: string;
  plantName?: string;
  providerCode?: string;
};

type BackendAlertSeverity = "healthy" | "warning" | "critical" | "unknown";
type BackendAlert = {
  id: string;
  type: string;
  severity: BackendAlertSeverity;
  title?: string;
  message?: string;
  source: string;
  plant_id: string | null;
  detected_at: string;
  metadata?: Record<string, unknown>;
};
type AlertsSummaryResponse = {
  generated_at: string;
  total: number;
  active_alerts: number;
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  alerts: BackendAlert[];
};

type DashboardData = {
  health: HealthResponse | null;
  system: SystemStatusResponse | null;
  plants: SolarPlant[];
  providers: ForecastProvider[];
  forecastRuns: ForecastRun[];
  accuracy: AccuracySummary | null;
  accuracyRanking: AccuracyProviderRankingResponse | null;
  rejected: RejectedTelemetrySummary | null;
  telemetryLatest: TelemetryPoint | null;
  telemetryHistory: TelemetryPoint[];
  telemetrySummary: TelemetrySummary | null;
  telemetryAssetId: string | null;
  alertsSummary: AlertsSummaryResponse | null;
};

type DashboardState = {
  loading: boolean;
  error: string | null;
  data: DashboardData;
};

type Locale = "en" | "ru" | "kz";
type DataQualityPeriodKey = "24h" | "7d" | "30d";
type DataQualityStatus = "clean" | "watch" | "attention";
type MonitoringStatus = "healthy" | "warning" | "critical" | "unknown";
type AlertSeverity = BackendAlertSeverity | "info";
type AlertCategory = "telemetry" | "dataQuality" | "forecast" | "system" | "asset";
type DerivedAlert = {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title?: string;
  message?: string;
  type: string;
  entity: string;
  signalValue: string;
  sourceApi: string;
  recommendedAction: string;
  priority: number;
};
type SolarPlantProfileState = {
  loading: boolean;
  error: string | null;
  latest: TelemetryPoint | null;
  summary: TelemetrySummary | null;
  rejected: RejectedTelemetrySummary | null;
  accuracy: AccuracySummary | null;
  ranking: AccuracyProviderRankingResponse | null;
  alertsSummary: AlertsSummaryResponse | null;
};
type MessageValue = string | number;
type Translate = (key: string, values?: Record<string, MessageValue>) => string;

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";

const navigationItems = [
  { key: "overview", labelKey: "overview" },
  { key: "solar-plants", labelKey: "solarPlants" },
  { key: "solar-plant-profile", labelKey: "solarPlantProfile" },
  { key: "forecast-insights", labelKey: "forecastInsights" },
  { key: "alerts-center", labelKey: "alertsCenter" },
  { key: "forecast-accuracy-lab", labelKey: "forecastAccuracyLab" },
  { key: "forecast-providers", labelKey: "forecastProviders" },
  { key: "telemetry", labelKey: "telemetry" },
  { key: "rejected-telemetry", labelKey: "rejectedTelemetry" },
  { key: "system-status", labelKey: "systemStatus" },
] as const;

type SectionKey = (typeof navigationItems)[number]["key"];

const locales: Locale[] = ["en", "ru", "kz"];
const intlLocales: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
  kz: "kk-KZ",
};

const compactKzMonths = [
  "қаң",
  "ақп",
  "нау",
  "сәу",
  "мам",
  "мау",
  "шіл",
  "там",
  "қыр",
  "қаз",
  "қар",
  "жел",
];

const dataQualityPeriods: Array<{ key: DataQualityPeriodKey; labelKey: string; hours: number }> = [
  { key: "24h", labelKey: "last24h", hours: 24 },
  { key: "7d", labelKey: "last7d", hours: 24 * 7 },
  { key: "30d", labelKey: "last30d", hours: 24 * 30 },
];

const rejectionReasons = [
  "invalid_topic",
  "invalid_plant_id",
  "plant_not_found",
  "invalid_json",
  "invalid_timestamp",
  "future_timestamp",
  "stale_timestamp",
  "negative_power",
  "negative_energy",
  "power_exceeds_capacity",
  "db_error",
  "unknown_error",
] as const;

const forecastBaselineMape = 14;
const forecastTargetMape = 10;
const lastActualCsvImportStorageKey = "energy_copilot_last_actual_csv_import";
const lastForecastCsvImportStorageKey = "energy_copilot_last_forecast_csv_import";
const strongForecastBiasThreshold = 1;
const criticalRejectionReasons = new Set([
  "invalid_topic",
  "plant_not_found",
  "invalid_json",
  "negative_power",
  "power_exceeds_capacity",
]);

const alertSeverityRank: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
  info: 4,
};

const messages = {
  en: enMessages,
  ru: ruMessages,
  kz: kzMessages,
};

function createMessageTranslator(localeMessages: typeof enMessages): Translate {
  return (key, values) => {
    const template = key.split(".").reduce<unknown>((current, segment) => {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, localeMessages);

    if (typeof template !== "string") {
      return key;
    }

    return Object.entries(values || {}).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      template,
    );
  };
}

const emptyData: DashboardData = {
  health: null,
  system: null,
  plants: [],
  providers: [],
  forecastRuns: [],
  accuracy: null,
  accuracyRanking: null,
  rejected: null,
  telemetryLatest: null,
  telemetryHistory: [],
  telemetrySummary: null,
  telemetryAssetId: null,
  alertsSummary: null,
};

function getApiBaseUrl() {
  if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
    return "";
  }

  return configuredApiBaseUrl;
}

function buildUrl(path: string, params?: Record<string, string>) {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}${path}`;
  if (!params) {
    return url;
  }

  const search = new URLSearchParams(params);
  return `${url}?${search.toString()}`;
}

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const response = await fetch(buildUrl(path, params));
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function isLastCsvImportSummary(value: unknown): value is LastCsvImportSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = value as Record<string, unknown>;
  return (
    typeof summary.fileName === "string" &&
    typeof summary.importedRows === "number" &&
    typeof summary.rejectedRows === "number" &&
    typeof summary.importedAt === "string"
  );
}

function readLastCsvImportSummary(storageKey: string): LastCsvImportSummary | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return null;
    }
    const parsedValue = JSON.parse(storedValue) as unknown;
    return isLastCsvImportSummary(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeLastCsvImportSummary(storageKey: string, summary: LastCsvImportSummary) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(summary));
}

function formatNumber(
  value: number | null | undefined,
  digits = 1,
  fallback = "",
  locale: Locale = "en",
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return new Intl.NumberFormat(intlLocales[locale], {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(
  value: number | null | undefined,
  fallback = "",
  locale: Locale = "en",
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${formatNumber(value, 2, fallback, locale)}%`;
}

function formatSignedPercent(
  value: number | null | undefined,
  fallback = "",
  locale: Locale = "en",
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1, fallback, locale)}%`;
}

function formatTranslatedUnit(
  value: number | null | undefined,
  unitKey: string,
  t: Translate,
  fallback: string,
  digits = 1,
  locale: Locale = "en",
) {
  const formattedValue = formatNumber(value, digits, "", locale);
  return formattedValue ? t(unitKey, { value: formattedValue }) : fallback;
}

function normalizeMachineValue(value: string) {
  return value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function normalizeReason(value: string) {
  return value.replaceAll("_", " ");
}

function translateMachineValue(namespace: string, value: string | undefined, t: Translate, fallback: string) {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeMachineValue(value);
  const key = `${namespace}.${normalized}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function translateStatusLabel(status: string | undefined | null, t: Translate, fallback: string) {
  return translateMachineValue("status", status || undefined, t, fallback);
}

function translateRejectionReason(reason: string | undefined, t: Translate, fallback: string) {
  if (!reason) {
    return fallback;
  }

  const key = `dataQuality.reasons.${reason}`;
  const translated = t(key);
  return translated === key ? normalizeReason(reason) : translated;
}

function translateTelemetrySource(source: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("telemetry.sources", source, t, fallback);
}

function translateTelemetryQuality(quality: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("telemetry.quality", quality, t, fallback);
}

function getProviderDisplayKey(name: string | undefined, code?: string) {
  const normalized = `${code || ""} ${name || ""}`.toLowerCase();
  if (normalized.includes("internal_baseline") || normalized.includes("internal baseline")) {
    return "internalBaseline";
  }
  if (normalized.includes("manual_csv_actuals") || normalized.includes("actuals reference")) {
    return "manualCsvActuals";
  }
  if (normalized.includes("manual_csv_forecast") || normalized.includes("forecast provider")) {
    return "manualCsvForecast";
  }
  if (normalized.includes("manual")) {
    return "manualForecast";
  }
  if (normalized.includes("mock")) {
    return "mockForecast";
  }
  return null;
}

function translateProviderName(
  name: string | undefined,
  code: string | undefined,
  t: Translate,
  fallback: string,
) {
  if (!name) {
    return fallback;
  }

  const displayKey = getProviderDisplayKey(name, code);
  if (!displayKey) {
    return name;
  }

  const key = `forecastProviders.demoNames.${displayKey}`;
  const translated = t(key);
  return translated === key ? name : translated;
}

function translateProviderType(providerType: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("forecastProviders.providerTypes", providerType, t, fallback);
}

function translateProviderStatus(status: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("forecastProviders.statuses", status, t, fallback);
}

function translateProviderDataStatus(status: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("forecastProviders.dataStatuses", status, t, fallback);
}

function translateProviderAction(action: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("forecastProviders.actions", action, t, fallback);
}

function translateProviderCompactStatus(status: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue(
    "forecastProviders.compactStatuses",
    status,
    t,
    translateProviderStatus(status, t, fallback),
  );
}

function translateProviderCompactDataStatus(status: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue(
    "forecastProviders.compactDataStatuses",
    status,
    t,
    translateProviderDataStatus(status, t, fallback),
  );
}

function translateProviderCompactAction(action: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue(
    "forecastProviders.compactActions",
    action,
    t,
    translateProviderAction(action, t, fallback),
  );
}

function translateProviderNote(note: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("forecastProviders.notes", note, t, fallback);
}

function translateMonitoringCompactStatus(status: MonitoringStatus, t: Translate) {
  const compactKey = `systemHealth.compactStatus.${status}`;
  const compactLabel = t(compactKey);
  return compactLabel === compactKey ? t(`systemHealth.status.${status}`) : compactLabel;
}

function translateFreshnessCompactStatus(
  status: TelemetrySummary["data_freshness_status"] | undefined,
  t: Translate,
  fallback: string,
) {
  if (!status) {
    return fallback;
  }

  const compactKey = `telemetry.compactFreshness.${status}`;
  const compactLabel = t(compactKey);
  return compactLabel === compactKey ? t(`telemetry.freshness.${status}`) : compactLabel;
}

function translateAlertCompactSeverity(severity: AlertSeverity, t: Translate) {
  const compactKey = `alertsCenter.compactSeverity.${severity}`;
  const compactLabel = t(compactKey);
  return compactLabel === compactKey ? t(`alertsCenter.severity.${severity}`) : compactLabel;
}

function translateForecastImportError(message: string | undefined, t: Translate, fallback: string) {
  return translateMachineValue("accuracyLab.forecastImport.validation", message, t, fallback);
}

function getProviderBadgeTone(value: string | undefined) {
  const normalized = normalizeMachineValue(value || "unknown");
  if (
    normalized === "active" ||
    normalized === "connected" ||
    normalized === "ready_for_connection" ||
    normalized === "ready_for_pilot_review" ||
    normalized === "pilot_ready" ||
    normalized === "ready_for_pilot_check"
  ) {
    return "good";
  }
  if (normalized === "simulated" || normalized === "needs_configuration" || normalized === "no_recent_forecast") {
    return "warning";
  }
  return "muted";
}

function translateMonitoringStatusValue(
  status: string | undefined | null,
  t: Translate,
  fallback: string,
) {
  if (!status) {
    return fallback;
  }
  return t(`systemHealth.status.${getMonitoringStatus(status)}`);
}

function formatCapacityMw(valueKw: number, fallback: string, locale: Locale = "en") {
  return `${formatNumber(valueKw / 1000, 2, fallback, locale)} MW`;
}

function formatPlantLocation(plant: SolarPlant, fallback: string, locale: Locale = "en") {
  if (plant.latitude === null || plant.latitude === undefined) {
    return fallback;
  }

  if (plant.longitude === null || plant.longitude === undefined) {
    return fallback;
  }

  return `${formatNumber(plant.latitude, 4, fallback, locale)}, ${formatNumber(
    plant.longitude,
    4,
    fallback,
    locale,
  )}`;
}

function formatTimeParts(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDate(value: string | undefined, fallback: string, locale: Locale = "en") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  if (locale === "kz") {
    return `${date.getDate()} ${compactKzMonths[date.getMonth()]} ${date.getFullYear()}`;
  }

  return date.toLocaleDateString(intlLocales[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(
  value: string | null | undefined,
  fallback: string,
  locale: Locale = "en",
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  if (locale === "kz") {
    return `${date.getDate()} ${compactKzMonths[date.getMonth()]} ${date.getFullYear()}, ${formatTimeParts(
      date,
    )}`;
  }

  return date.toLocaleString(intlLocales[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: locale === "en",
  });
}

function getDataQualityPeriodRange(periodKey: DataQualityPeriodKey) {
  const selectedPeriod =
    dataQualityPeriods.find((period) => period.key === periodKey) || dataQualityPeriods[1];
  const periodTo = new Date();
  const periodFrom = new Date(periodTo.getTime() - selectedPeriod.hours * 60 * 60 * 1000);

  return {
    from: periodFrom.toISOString(),
    to: periodTo.toISOString(),
  };
}

function getPlantName(plants: SolarPlant[], plantId: string | null | undefined, fallback: string) {
  if (!plantId) {
    return fallback;
  }

  return plants.find((plant) => plant.id === plantId)?.name || plantId;
}

function getDataQualityStatus(totalRejected: number, rejectionRate: number | null): DataQualityStatus {
  if (totalRejected === 0) {
    return "clean";
  }

  if (rejectionRate !== null && rejectionRate < 2) {
    return "watch";
  }

  return "attention";
}

function getMonitoringStatus(status: string | undefined | null): MonitoringStatus {
  if (!status) {
    return "unknown";
  }

  if (["ok", "active", "healthy", "fresh"].includes(status)) {
    return "healthy";
  }

  if (["degraded", "stale", "warning", "open"].includes(status)) {
    return "warning";
  }

  if (["error", "critical", "offline", "failed", "down"].includes(status)) {
    return "critical";
  }

  return "unknown";
}

function getFreshnessMonitoringStatus(
  status: TelemetrySummary["data_freshness_status"] | undefined,
): MonitoringStatus {
  if (status === "fresh") {
    return "healthy";
  }
  if (status === "stale") {
    return "warning";
  }
  if (status === "offline") {
    return "critical";
  }
  return "unknown";
}

function getPlatformStatus(statuses: MonitoringStatus[]): MonitoringStatus {
  if (statuses.includes("critical")) {
    return "critical";
  }
  if (statuses.includes("warning")) {
    return "warning";
  }
  if (statuses.length > 0 && statuses.every((status) => status === "healthy")) {
    return "healthy";
  }
  return "unknown";
}

function getLatestForecastUpdate(forecastRuns: ForecastRun[]) {
  const timestamps = forecastRuns
    .map((run) => run.created_at || run.run_at)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function translateEnvironment(value: string | undefined, t: Translate, fallback: string) {
  if (!value) {
    return fallback;
  }

  const key = `systemHealth.environments.${normalizeMachineValue(value)}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function StatusBadge({ status, t }: { status?: string; t: Translate }) {
  const normalized = normalizeMachineValue(status || "unknown");
  const displayStatus = translateStatusLabel(normalized, t, normalized);
  const tone =
    normalized === "ok" || normalized === "active" || normalized === "fixed"
      ? "good"
      : normalized === "degraded" || normalized === "open" || normalized === "warning"
        ? "warning"
        : "muted";

  return <span className={`status-badge ${tone}`}>{displayStatus}</span>;
}

function ProviderBadge({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return <span className={`status-badge provider-badge ${getProviderBadgeTone(value)}`}>{label}</span>;
}

function AlertSeverityBadge({ severity, t }: { severity: AlertSeverity; t: Translate }) {
  return (
    <span className={`alert-severity-badge ${severity}`}>
      {translateAlertCompactSeverity(severity, t)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  loading,
  t,
  valueClassName = "",
}: {
  label: string;
  value: string;
  helper: string;
  loading: boolean;
  t: Translate;
  valueClassName?: string;
}) {
  return (
    <section className="metric-card">
      <p>{label}</p>
      <strong className={loading ? "metric-value" : `metric-value ${valueClassName}`.trim()}>
        {loading ? t("common.loading") : value}
      </strong>
      <span>{loading ? t("common.fetchingLiveData") : helper}</span>
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SectionPlaceholder({
  title,
  t,
}: {
  title: string;
  t: Translate;
}) {
  return (
    <section className="placeholder-panel">
      <p className="eyebrow">{t("placeholders.eyebrow")}</p>
      <h2>{title}</h2>
      <p>{t("placeholders.detail", { section: title })}</p>
    </section>
  );
}

function SolarPlantsSection({
  plants,
  loading,
  locale,
  onPlantCreated,
  onSelectPlant,
  t,
}: {
  plants: SolarPlant[];
  loading: boolean;
  locale: Locale;
  onPlantCreated: (plant: SolarPlant) => void;
  onSelectPlant: (plantId: string) => void;
  t: Translate;
}) {
  const noData = t("common.noData");
  const totalCapacityKw = plants.reduce((sum, plant) => sum + plant.capacity_kw, 0);
  const activePlants = plants.filter((plant) => plant.status === "active").length;
  const [form, setForm] = useState<SolarPlantFormState>({
    name: "",
    capacityKw: "",
    latitude: "",
    longitude: "",
    timezone: "Asia/Almaty",
    status: "active",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateForm = (field: keyof SolarPlantFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddPlant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    const capacityKw = Number(form.capacityKw);
    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;

    if (!form.name.trim() || !Number.isFinite(capacityKw) || capacityKw <= 0) {
      setFormMessage({ type: "error", text: t("solarPlants.addForm.validationError") });
      return;
    }

    setFormSubmitting(true);
    try {
      const response = await fetch(buildUrl("/api/v1/solar-plants"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          capacity_kw: capacityKw,
          latitude,
          longitude,
          timezone: form.timezone.trim() || "Asia/Almaty",
          status: form.status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Create solar plant returned ${response.status}`);
      }

      const createdPlant = (await response.json()) as SolarPlant;
      onPlantCreated(createdPlant);
      setForm((current) => ({
        ...current,
        name: "",
        capacityKw: "",
        latitude: "",
        longitude: "",
      }));
      setFormMessage({
        type: "success",
        text: t("solarPlants.addForm.success", { name: createdPlant.name }),
      });
    } catch {
      setFormMessage({ type: "error", text: t("solarPlants.addForm.error") });
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <section className="section-stack">
      <section className="metric-grid solar-metric-grid">
        <MetricCard
          helper={t("solarPlants.kpi.totalPlantsHelper")}
          label={t("solarPlants.kpi.totalPlants")}
          loading={loading}
          t={t}
          value={formatNumber(plants.length, 0, noData, locale)}
        />
        <MetricCard
          helper={t("solarPlants.kpi.activePlantsHelper")}
          label={t("solarPlants.kpi.activePlants")}
          loading={loading}
          t={t}
          value={formatNumber(activePlants, 0, noData, locale)}
        />
        <MetricCard
          helper={formatCapacityMw(totalCapacityKw, noData, locale)}
          label={t("solarPlants.kpi.totalCapacity")}
          loading={loading}
          t={t}
          value={t("solarPlants.kpi.capacityValue", {
            kw: formatNumber(totalCapacityKw, 0, noData, locale),
            mw: formatNumber(totalCapacityKw / 1000, 2, noData, locale),
          })}
        />
        <MetricCard
          helper={t("solarPlants.kpi.telemetryTargetHelper")}
          label={t("solarPlants.kpi.telemetryTarget")}
          loading={loading}
          t={t}
          value={t("solarPlants.kpi.telemetryTargetValue")}
        />
      </section>

      <section className="solar-layout">
        <Panel eyebrow={t("solarPlants.assetListEyebrow")} title={t("solarPlants.assetListTitle")}>
          <form className="solar-plant-form" onSubmit={handleAddPlant}>
            <div className="solar-plant-form-heading">
              <div>
                <span>{t("solarPlants.addForm.eyebrow")}</span>
                <strong>{t("solarPlants.addForm.title")}</strong>
              </div>
              <p>{t("solarPlants.addForm.helper")}</p>
            </div>
            <div className="solar-plant-form-grid">
              <label>
                <span>{t("solarPlants.addForm.name")}</span>
                <input
                  disabled={formSubmitting}
                  onChange={(event) => updateForm("name", event.target.value)}
                  required
                  type="text"
                  value={form.name}
                />
              </label>
              <label>
                <span>{t("solarPlants.addForm.capacityKw")}</span>
                <input
                  disabled={formSubmitting}
                  min="0"
                  onChange={(event) => updateForm("capacityKw", event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={form.capacityKw}
                />
              </label>
              <label>
                <span>{t("solarPlants.addForm.latitude")}</span>
                <input
                  disabled={formSubmitting}
                  max="90"
                  min="-90"
                  onChange={(event) => updateForm("latitude", event.target.value)}
                  step="0.000001"
                  type="number"
                  value={form.latitude}
                />
              </label>
              <label>
                <span>{t("solarPlants.addForm.longitude")}</span>
                <input
                  disabled={formSubmitting}
                  max="180"
                  min="-180"
                  onChange={(event) => updateForm("longitude", event.target.value)}
                  step="0.000001"
                  type="number"
                  value={form.longitude}
                />
              </label>
              <label>
                <span>{t("solarPlants.addForm.timezone")}</span>
                <input
                  disabled={formSubmitting}
                  onChange={(event) => updateForm("timezone", event.target.value)}
                  type="text"
                  value={form.timezone}
                />
              </label>
              <label>
                <span>{t("solarPlants.addForm.status")}</span>
                <select
                  disabled={formSubmitting}
                  onChange={(event) => updateForm("status", event.target.value)}
                  value={form.status}
                >
                  <option value="active">{t("status.active")}</option>
                  <option value="inactive">{t("status.inactive")}</option>
                </select>
              </label>
            </div>
            {formMessage ? (
              <div className={`solar-plant-form-message ${formMessage.type}`}>{formMessage.text}</div>
            ) : null}
            <button className="solar-plant-form-submit" disabled={formSubmitting} type="submit">
              {formSubmitting ? t("solarPlants.addForm.submitting") : t("solarPlants.addForm.submit")}
            </button>
          </form>

          {loading ? (
            <EmptyState detail={t("solarPlants.loadingDetail")} title={t("solarPlants.loadingTitle")} />
          ) : plants.length > 0 ? (
            <div className="plants-list">
              {plants.map((plant) => (
                <button
                  aria-label={plant.name}
                  className="plant-list-card"
                  key={plant.id}
                  onClick={() => onSelectPlant(plant.id)}
                  type="button"
                >
                  <div className="plant-list-card-main">
                    <strong>{plant.name}</strong>
                    <StatusBadge status={plant.status} t={t} />
                  </div>
                  <div className="plant-list-card-meta">
                    <span>
                      <small>{t("solarPlants.table.capacity")}</small>
                      {t("solarPlants.table.capacityValue", {
                        kw: formatNumber(plant.capacity_kw, 0, noData, locale),
                        mw: formatNumber(plant.capacity_kw / 1000, 2, noData, locale),
                      })}
                    </span>
                    <span>
                      <small>{t("solarPlants.table.timezone")}</small>
                      {plant.timezone || noData}
                    </span>
                    <span>
                      <small>{t("solarPlants.table.location")}</small>
                      {formatPlantLocation(plant, noData, locale)}
                    </span>
                    <span>
                      <small>{t("solarPlants.table.createdAt")}</small>
                      {formatDate(plant.created_at, noData, locale)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              detail={t("solarPlants.emptyDetail")}
              title={t("solarPlants.emptyTitle")}
            />
          )}
        </Panel>

        <Panel eyebrow={t("solarPlants.pilot.eyebrow")} title={t("solarPlants.pilot.title")}>
          <div className="pilot-card">
            <div className="pilot-hero">
              <span>{t("solarPlants.pilot.nameLabel")}</span>
              <strong>{t("solarPlants.pilot.name")}</strong>
              <p>{t("solarPlants.pilot.location")}</p>
            </div>

            <div className="pilot-grid">
              <div>
                <span>{t("solarPlants.pilot.capacityLabel")}</span>
                <strong>{t("solarPlants.pilot.capacityValue")}</strong>
              </div>
              <div>
                <span>{t("solarPlants.pilot.scadaLabel")}</span>
                <strong>{t("solarPlants.pilot.scadaValue")}</strong>
              </div>
              <div>
                <span>{t("solarPlants.pilot.invertersLabel")}</span>
                <strong>{t("solarPlants.pilot.invertersValue")}</strong>
              </div>
              <div>
                <span>{t("solarPlants.pilot.telemetryLabel")}</span>
                <strong>{t("solarPlants.pilot.telemetryValue")}</strong>
              </div>
              <div>
                <span>{t("solarPlants.pilot.baselineLabel")}</span>
                <strong>{t("solarPlants.pilot.baselineValue")}</strong>
              </div>
              <div>
                <span>{t("solarPlants.pilot.targetLabel")}</span>
                <strong>{t("solarPlants.pilot.targetValue")}</strong>
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </section>
  );
}

function getAccuracyTargetStatus(avgMape: number | null | undefined) {
  if (avgMape === null || avgMape === undefined || Number.isNaN(avgMape)) {
    return "noData";
  }
  if (avgMape < 5) {
    return "excellent";
  }
  if (avgMape < 10) {
    return "onTarget";
  }
  return "aboveTarget";
}

function sortAlerts(alerts: DerivedAlert[]) {
  return [...alerts].sort((first, second) => {
    const severityDelta = alertSeverityRank[first.severity] - alertSeverityRank[second.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return first.priority - second.priority;
  });
}

function getHighestAlertSeverity(alerts: DerivedAlert[]): AlertSeverity | null {
  return sortAlerts(alerts)[0]?.severity || null;
}

function getBackendAlertCategory(type: string): AlertCategory {
  if (type === "telemetry_freshness") {
    return "telemetry";
  }
  if (type === "rejected_telemetry") {
    return "dataQuality";
  }
  if (type === "system_health") {
    return "system";
  }
  if (["forecast_accuracy", "forecast_runs", "provider_performance"].includes(type)) {
    return "forecast";
  }
  return "system";
}

function getAlertMetadataString(alert: BackendAlert, key: string, fallback: string) {
  const value = alert.metadata?.[key];
  if (value === null || value === undefined) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : fallback;
  }
  return String(value);
}

function getAlertMetadataNumber(alert: BackendAlert, key: string) {
  const value = alert.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function translateBackendAlertTitle(alert: BackendAlert, t: Translate) {
  const key = `alertsCenter.backendAlerts.${alert.type}.title`;
  const translated = t(key);
  return translated === key ? alert.title : translated;
}

function translateBackendAlertMessage(
  alert: BackendAlert,
  t: Translate,
  locale: Locale,
  fallback: string,
) {
  const key = `alertsCenter.backendAlerts.${alert.type}.message.${alert.severity}`;
  const plant = getAlertMetadataString(alert, "plant_name", alert.plant_id || fallback);
  const count = getAlertMetadataNumber(alert, "count") ?? getAlertMetadataNumber(alert, "recent_runs_count");
  const minutes = getAlertMetadataNumber(alert, "age_minutes");
  const threshold = getAlertMetadataNumber(alert, "threshold_minutes");
  const mape = getAlertMetadataNumber(alert, "avg_mape") ?? getAlertMetadataNumber(alert, "best_mape");
  const target = getAlertMetadataNumber(alert, "target_mape");
  const translated = t(key, {
    plant,
    count: formatNumber(count, 0, fallback, locale),
    minutes: formatNumber(minutes, 0, fallback, locale),
    threshold: formatNumber(threshold, 0, fallback, locale),
    mape: formatPercent(mape, fallback, locale),
    target: formatPercent(target, fallback, locale),
    reason: getAlertMetadataString(alert, "top_reason", fallback),
    status: getAlertMetadataString(alert, "status", fallback),
    dependencies: getAlertMetadataString(alert, "failed_dependencies", fallback),
  });
  return translated === key ? alert.message : translated;
}

function mapBackendAlert(alert: BackendAlert, locale: Locale, t: Translate): DerivedAlert {
  const noData = t("common.noData");
  const category = getBackendAlertCategory(alert.type);
  return {
    id: alert.id,
    severity: alert.severity,
    category,
    type: alert.type,
    title: translateBackendAlertTitle(alert, t),
    message: translateBackendAlertMessage(alert, t, locale, noData),
    entity: getAlertMetadataString(alert, "plant_name", alert.plant_id || t(`alertsCenter.categories.${category}`)),
    signalValue: translateBackendAlertMessage(alert, t, locale, noData),
    sourceApi: alert.source,
    recommendedAction: t(`alertsCenter.backendAlerts.${alert.type}.action`),
    priority: alertSeverityRank[alert.severity],
  };
}

function deriveAlertsFromDashboardData(data: DashboardData, locale: Locale, t: Translate): DerivedAlert[] {
  const noData = t("common.noData");
  const alerts: DerivedAlert[] = [];
  const addAlert = (alert: DerivedAlert) => {
    alerts.push(alert);
  };
  const pilotPlant =
    data.plants.find((plant) => plant.name.toLowerCase().includes("varvar")) || data.plants[0] || null;
  const telemetryEntity = pilotPlant?.name || data.telemetryAssetId || t("alertsCenter.entities.telemetryAsset");

  if (data.telemetrySummary?.data_freshness_status === "offline") {
    addAlert({
      id: "telemetry-offline",
      severity: "critical",
      category: "telemetry",
      type: t("alertsCenter.alertTypes.telemetryOffline"),
      entity: telemetryEntity,
      signalValue: t("alertsCenter.signals.freshness", {
        value: t("telemetry.freshness.offline"),
      }),
      sourceApi: "/api/v1/telemetry/summary",
      recommendedAction: t("alertsCenter.actions.checkTelemetryConnection"),
      priority: 10,
    });
  } else if (data.telemetrySummary?.data_freshness_status === "stale") {
    addAlert({
      id: "telemetry-stale",
      severity: "warning",
      category: "telemetry",
      type: t("alertsCenter.alertTypes.telemetryStale"),
      entity: telemetryEntity,
      signalValue: t("alertsCenter.signals.freshness", {
        value: t("telemetry.freshness.stale"),
      }),
      sourceApi: "/api/v1/telemetry/summary",
      recommendedAction: t("alertsCenter.actions.checkTelemetryDelay"),
      priority: 20,
    });
  }

  if (
    data.telemetrySummary?.possible_data_gap_minutes !== null &&
    data.telemetrySummary?.possible_data_gap_minutes !== undefined &&
    data.telemetrySummary.possible_data_gap_minutes > 30
  ) {
    addAlert({
      id: "telemetry-gap",
      severity: data.telemetrySummary.possible_data_gap_minutes > 120 ? "critical" : "warning",
      category: "telemetry",
      type: t("alertsCenter.alertTypes.telemetryGap"),
      entity: telemetryEntity,
      signalValue: t("alertsCenter.signals.dataGap", {
        value: formatTranslatedUnit(
          data.telemetrySummary.possible_data_gap_minutes,
          "telemetry.units.minutes",
          t,
          noData,
          0,
          locale,
        ),
      }),
      sourceApi: "/api/v1/telemetry/summary",
      recommendedAction: t("alertsCenter.actions.checkTelemetryGap"),
      priority: 30,
    });
  }

  if (data.rejected && data.rejected.total > 0) {
    addAlert({
      id: "rejected-telemetry-exists",
      severity: "warning",
      category: "dataQuality",
      type: t("alertsCenter.alertTypes.rejectedTelemetry"),
      entity: telemetryEntity,
      signalValue: t("alertsCenter.signals.rejectedTotal", {
        value: formatNumber(data.rejected.total, 0, noData, locale),
      }),
      sourceApi: "/api/v1/telemetry/rejected/summary",
      recommendedAction: t("alertsCenter.actions.reviewRejectedTelemetry"),
      priority: 40,
    });

    const topRejectedReason = [...data.rejected.items].sort((first, second) => second.count - first.count)[0];
    if (topRejectedReason && criticalRejectionReasons.has(topRejectedReason.reason)) {
      addAlert({
        id: `top-rejection-${topRejectedReason.reason}`,
        severity: "critical",
        category: "dataQuality",
        type: t("alertsCenter.alertTypes.criticalRejectedReason"),
        entity: telemetryEntity,
        signalValue: t("alertsCenter.signals.topRejectedReason", {
          reason: translateRejectionReason(topRejectedReason.reason, t, noData),
          count: formatNumber(topRejectedReason.count, 0, noData, locale),
        }),
        sourceApi: "/api/v1/telemetry/rejected/summary",
        recommendedAction: t("alertsCenter.actions.fixRejectedReason"),
        priority: 15,
      });
    }
  }

  const currentMape = data.accuracy?.avg_mape ?? null;
  if (currentMape !== null && !Number.isNaN(currentMape) && currentMape > forecastTargetMape) {
    addAlert({
      id: "mape-above-target",
      severity: currentMape >= forecastBaselineMape ? "critical" : "warning",
      category: "forecast",
      type: t("alertsCenter.alertTypes.mapeAboveTarget"),
      entity: pilotPlant?.name || t("alertsCenter.entities.forecastAccuracy"),
      signalValue: t("alertsCenter.signals.mapeTarget", {
        current: formatPercent(currentMape, noData, locale),
        target: t("forecastInsights.kpi.targetValue"),
      }),
      sourceApi: "/api/v1/accuracy-lab/summary",
      recommendedAction: t("alertsCenter.actions.reviewForecastAccuracy"),
      priority: 50,
    });
  }

  if (currentMape !== null && !Number.isNaN(currentMape) && currentMape >= forecastBaselineMape) {
    addAlert({
      id: "mape-above-baseline",
      severity: "critical",
      category: "forecast",
      type: t("alertsCenter.alertTypes.mapeAboveBaseline"),
      entity: pilotPlant?.name || t("alertsCenter.entities.forecastAccuracy"),
      signalValue: t("alertsCenter.signals.mapeBaseline", {
        current: formatPercent(currentMape, noData, locale),
        baseline: t("forecastInsights.kpi.baselineValue"),
      }),
      sourceApi: "/api/v1/accuracy-lab/summary",
      recommendedAction: t("alertsCenter.actions.escalateForecastQuality"),
      priority: 25,
    });
  }

  const rankedProviders = data.accuracyRanking?.providers.filter(
    (provider) => provider.avg_mape !== null && !Number.isNaN(provider.avg_mape),
  ) || [];
  const worstProvider = rankedProviders[rankedProviders.length - 1];
  if (worstProvider?.avg_mape !== null && worstProvider?.avg_mape !== undefined && worstProvider.avg_mape > forecastTargetMape) {
    addAlert({
      id: `provider-worst-mape-${worstProvider.provider_id}`,
      severity: worstProvider.avg_mape >= forecastBaselineMape ? "critical" : "warning",
      category: "forecast",
      type: t("alertsCenter.alertTypes.providerWorstMape"),
      entity: translateProviderName(worstProvider.provider_name, worstProvider.provider_code, t, noData),
      signalValue: t("alertsCenter.signals.providerMape", {
        value: formatPercent(worstProvider.avg_mape, noData, locale),
      }),
      sourceApi: "/api/v1/accuracy-lab/providers/ranking",
      recommendedAction: t("alertsCenter.actions.compareForecastProviders"),
      priority: 60,
    });
  }

  const avgBias = data.accuracy?.avg_bias ?? null;
  if (avgBias !== null && !Number.isNaN(avgBias) && Math.abs(avgBias) >= strongForecastBiasThreshold) {
    addAlert({
      id: "forecast-strong-bias",
      severity: "warning",
      category: "forecast",
      type: t("alertsCenter.alertTypes.strongForecastBias"),
      entity: pilotPlant?.name || t("alertsCenter.entities.forecastAccuracy"),
      signalValue: t("alertsCenter.signals.bias", {
        value: formatNumber(avgBias, 2, noData, locale),
      }),
      sourceApi: "/api/v1/accuracy-lab/summary",
      recommendedAction: t("alertsCenter.actions.reviewForecastBias"),
      priority: 70,
    });
  }

  if (data.forecastRuns.length === 0) {
    addAlert({
      id: "no-forecast-runs",
      severity: "warning",
      category: "forecast",
      type: t("alertsCenter.alertTypes.noForecastRuns"),
      entity: pilotPlant?.name || t("alertsCenter.entities.forecastRuns"),
      signalValue: t("alertsCenter.signals.noForecastRuns"),
      sourceApi: "/api/v1/forecast-runs",
      recommendedAction: t("alertsCenter.actions.checkForecastScheduler"),
      priority: 35,
    });
  }

  const forecastRunIssues = data.forecastRuns.filter((run) =>
    ["failed", "pending"].includes(normalizeMachineValue(run.status)),
  );
  if (forecastRunIssues.length > 0) {
    const failedCount = forecastRunIssues.filter((run) => normalizeMachineValue(run.status) === "failed").length;
    addAlert({
      id: "forecast-run-status-issues",
      severity: failedCount > 0 ? "critical" : "warning",
      category: "forecast",
      type: t("alertsCenter.alertTypes.forecastRunStatus"),
      entity: pilotPlant?.name || t("alertsCenter.entities.forecastRuns"),
      signalValue: t("alertsCenter.signals.forecastRunIssues", {
        count: formatNumber(forecastRunIssues.length, 0, noData, locale),
      }),
      sourceApi: "/api/v1/forecast-runs",
      recommendedAction: t("alertsCenter.actions.checkForecastRuns"),
      priority: 45,
    });
  }

  Object.entries(data.system?.dependencies || {}).forEach(([name, dependency]) => {
    const normalizedStatus = normalizeMachineValue(dependency.status || "unknown");
    if (["critical", "offline", "down", "failed", "error"].includes(normalizedStatus)) {
      addAlert({
        id: `dependency-${name}-${normalizedStatus}`,
        severity: "critical",
        category: "system",
        type: t("alertsCenter.alertTypes.systemDependency"),
        entity: name,
        signalValue: t("alertsCenter.signals.dependencyStatus", {
          value: translateStatusLabel(normalizedStatus, t, noData),
        }),
        sourceApi: "/api/v1/system/status",
        recommendedAction: t("alertsCenter.actions.checkSystemDependency"),
        priority: 5,
      });
    }
  });

  if (data.plants.length === 0) {
    addAlert({
      id: "solar-plant-missing",
      severity: "critical",
      category: "asset",
      type: t("alertsCenter.alertTypes.solarPlantMissing"),
      entity: t("alertsCenter.entities.varvarinskayaSpp"),
      signalValue: t("alertsCenter.signals.plantMissing"),
      sourceApi: "/api/v1/solar-plants",
      recommendedAction: t("alertsCenter.actions.checkSolarPlantRegistry"),
      priority: 12,
    });
  } else {
    data.plants
      .filter((plant) => normalizeMachineValue(plant.status) !== "active")
      .forEach((plant) => {
        addAlert({
          id: `solar-plant-inactive-${plant.id}`,
          severity: "warning",
          category: "asset",
          type: t("alertsCenter.alertTypes.solarPlantInactive"),
          entity: plant.name,
          signalValue: t("alertsCenter.signals.plantStatus", {
            value: translateStatusLabel(plant.status, t, noData),
          }),
          sourceApi: "/api/v1/solar-plants",
          recommendedAction: t("alertsCenter.actions.checkSolarPlantRegistry"),
          priority: 80,
        });
      });
  }

  return sortAlerts(alerts);
}

function AlertsCenterSection({
  data,
  loading,
  locale,
  t,
}: {
  data: DashboardData;
  loading: boolean;
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const alerts = useMemo(
    () => sortAlerts((data.alertsSummary?.alerts || []).map((alert) => mapBackendAlert(alert, locale, t))),
    [data.alertsSummary, locale, t],
  );
  const activeAlerts = data.alertsSummary?.active_alerts ?? 0;
  const criticalAlerts = data.alertsSummary?.critical ?? 0;
  const warningAlerts = data.alertsSummary?.warning ?? 0;
  const forecastAlerts = alerts.filter((alert) => alert.category === "forecast").length;
  const dataQualityAlerts = alerts.filter((alert) => alert.category === "dataQuality").length;
  const systemAlerts = alerts.filter((alert) => alert.category === "system").length;
  const highestSeverity = getHighestAlertSeverity(alerts);
  const priorityAlerts = alerts.filter((alert) => ["critical", "warning"].includes(alert.severity)).slice(0, 5);

  return (
    <section className="section-stack">
      <section className="metric-grid alerts-metric-grid">
        <MetricCard
          helper={t("alertsCenter.kpi.activeAlertsHelper")}
          label={t("alertsCenter.kpi.activeAlerts")}
          loading={loading}
          t={t}
          value={formatNumber(activeAlerts, 0, noData, locale)}
        />
        <MetricCard
          helper={t("alertsCenter.kpi.criticalAlertsHelper")}
          label={t("alertsCenter.kpi.criticalAlerts")}
          loading={loading}
          t={t}
          value={formatNumber(criticalAlerts, 0, noData, locale)}
        />
        <MetricCard
          helper={t("alertsCenter.kpi.warningAlertsHelper")}
          label={t("alertsCenter.kpi.warningAlerts")}
          loading={loading}
          t={t}
          value={formatNumber(warningAlerts, 0, noData, locale)}
        />
        <MetricCard
          helper={t("alertsCenter.kpi.forecastAlertsHelper")}
          label={t("alertsCenter.kpi.forecastAlerts")}
          loading={loading}
          t={t}
          value={formatNumber(forecastAlerts, 0, noData, locale)}
        />
        <MetricCard
          helper={t("alertsCenter.kpi.dataQualityAlertsHelper")}
          label={t("alertsCenter.kpi.dataQualityAlerts")}
          loading={loading}
          t={t}
          value={formatNumber(dataQualityAlerts, 0, noData, locale)}
        />
        <MetricCard
          helper={t("alertsCenter.kpi.systemAlertsHelper")}
          label={t("alertsCenter.kpi.systemAlerts")}
          loading={loading}
          t={t}
          value={formatNumber(systemAlerts, 0, noData, locale)}
        />
        <MetricCard
          helper={t("alertsCenter.kpi.highestSeverityHelper")}
          label={t("alertsCenter.kpi.highestSeverity")}
          loading={loading}
          t={t}
          value={highestSeverity ? translateAlertCompactSeverity(highestSeverity, t) : noData}
          valueClassName="metric-value-text"
        />
      </section>

      <section className="alerts-layout">
        <Panel eyebrow={t("alertsCenter.priority.eyebrow")} title={t("alertsCenter.priority.title")}>
          {loading ? (
            <EmptyState
              detail={t("alertsCenter.loading.priorityDetail")}
              title={t("alertsCenter.loading.priorityTitle")}
            />
          ) : priorityAlerts.length > 0 ? (
            <div className="operator-priority-list">
              {priorityAlerts.map((alert) => (
                <div className={`operator-priority-item ${alert.severity}`} key={alert.id}>
                  <AlertSeverityBadge severity={alert.severity} t={t} />
                  <div>
                    <strong>{alert.title || alert.type}</strong>
                    <span>{alert.message || alert.signalValue}</span>
                    <small>{alert.recommendedAction}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              detail={t("alertsCenter.empty.priorityDetail")}
              title={t("alertsCenter.empty.priorityTitle")}
            />
          )}
        </Panel>

        <Panel eyebrow={t("alertsCenter.summary.eyebrow")} title={t("alertsCenter.summary.title")}>
          <div className="alerts-summary-card">
            <div>
              <span>{t("alertsCenter.summary.active")}</span>
              <strong>{formatNumber(activeAlerts, 0, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("alertsCenter.summary.healthy")}</span>
              <strong>{formatNumber(data.alertsSummary?.healthy, 0, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("alertsCenter.summary.unknown")}</span>
              <strong>{formatNumber(data.alertsSummary?.unknown, 0, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("alertsCenter.summary.generatedAt")}</span>
              <strong>{formatDateTime(data.alertsSummary?.generated_at, noData, locale)}</strong>
            </div>
          </div>
        </Panel>
      </section>

      <Panel eyebrow={t("alertsCenter.table.eyebrow")} title={t("alertsCenter.table.title")}>
        {loading ? (
          <EmptyState detail={t("alertsCenter.loading.tableDetail")} title={t("alertsCenter.loading.tableTitle")} />
        ) : alerts.length > 0 ? (
          <div className="alerts-table">
            <div className="alerts-table-head">
              <span>{t("alertsCenter.table.severity")}</span>
              <span>{t("alertsCenter.table.category")}</span>
              <span>{t("alertsCenter.table.alertType")}</span>
              <span>{t("alertsCenter.table.entity")}</span>
              <span>{t("alertsCenter.table.signalValue")}</span>
              <span>{t("alertsCenter.table.status")}</span>
              <span>{t("alertsCenter.table.sourceApi")}</span>
              <span>{t("alertsCenter.table.recommendedAction")}</span>
            </div>
            {alerts.map((alert) => (
              <div className="alerts-table-row" key={alert.id}>
                <span><AlertSeverityBadge severity={alert.severity} t={t} /></span>
                <span>{t(`alertsCenter.categories.${alert.category}`)}</span>
                <strong>{alert.title || alert.type}</strong>
                <span>{alert.entity}</span>
                <span>{alert.message || alert.signalValue}</span>
                <span>{translateAlertCompactSeverity(alert.severity, t)}</span>
                <span>{alert.sourceApi}</span>
                <span>{alert.recommendedAction}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState detail={t("alertsCenter.empty.tableDetail")} title={t("alertsCenter.empty.tableTitle")} />
        )}
      </Panel>
    </section>
  );
}

function SolarPlantProfileSection({
  plants,
  selectedPlantId,
  onSelectedPlantIdChange,
  forecastRuns,
  system,
  loading,
  period,
  locale,
  t,
}: {
  plants: SolarPlant[];
  selectedPlantId: string;
  onSelectedPlantIdChange: (plantId: string) => void;
  forecastRuns: ForecastRun[];
  system: SystemStatusResponse | null;
  loading: boolean;
  period: { from: string; to: string };
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const [profileState, setProfileState] = useState<SolarPlantProfileState>({
    loading: false,
    error: null,
    latest: null,
    summary: null,
    rejected: null,
    accuracy: null,
    ranking: null,
    alertsSummary: null,
  });
  const [stationDataFile, setStationDataFile] = useState<File | null>(null);
  const [uploadingTelemetry, setUploadingTelemetry] = useState(false);
  const [uploadResult, setUploadResult] = useState<TelemetryCsvImportResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: "info" | "success"; text: string } | null>(null);
  const [lastActualImport, setLastActualImport] = useState<LastCsvImportSummary | null>(null);
  const [profileRefreshToken, setProfileRefreshToken] = useState(0);

  useEffect(() => {
    setLastActualImport(readLastCsvImportSummary(lastActualCsvImportStorageKey));
  }, []);

  useEffect(() => {
    if (plants.length === 0) {
      onSelectedPlantIdChange("");
      return;
    }

    if (!selectedPlantId || !plants.some((plant) => plant.id === selectedPlantId)) {
      onSelectedPlantIdChange(plants[0].id);
    }
  }, [onSelectedPlantIdChange, plants, selectedPlantId]);

  useEffect(() => {
    let mounted = true;

    async function loadPlantProfile() {
      if (!selectedPlantId) {
        setProfileState({
          loading: false,
          error: null,
          latest: null,
          summary: null,
          rejected: null,
          accuracy: null,
          ranking: null,
          alertsSummary: null,
        });
        return;
      }

      setProfileState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const [latest, summary, rejected, accuracy, ranking, alertsSummary] = await Promise.allSettled([
        fetchJson<TelemetryPoint>("/api/v1/telemetry/latest", {
          asset_id: selectedPlantId,
        }),
        fetchJson<TelemetrySummary>("/api/v1/telemetry/summary", {
          asset_id: selectedPlantId,
          from: period.from,
          to: period.to,
        }),
        fetchJson<RejectedTelemetrySummary>("/api/v1/telemetry/rejected/summary", {
          from: period.from,
          to: period.to,
          plant_id: selectedPlantId,
          resolution_status: "open",
        }),
        fetchJson<AccuracySummary>("/api/v1/accuracy-lab/summary", {
          from: period.from,
          to: period.to,
          bucket: "day",
          solar_plant_id: selectedPlantId,
        }),
        fetchJson<AccuracyProviderRankingResponse>("/api/v1/accuracy-lab/providers/ranking", {
          from: period.from,
          to: period.to,
          bucket: "day",
          solar_plant_id: selectedPlantId,
        }),
        fetchJson<AlertsSummaryResponse>("/api/v1/alerts/summary", {
          from: period.from,
          to: period.to,
          plant_id: selectedPlantId,
        }),
      ]);

      if (!mounted) {
        return;
      }

      const nextState: SolarPlantProfileState = {
        loading: false,
        error: null,
        latest: latest.status === "fulfilled" ? latest.value : null,
        summary: summary.status === "fulfilled" ? summary.value : null,
        rejected: rejected.status === "fulfilled" ? rejected.value : null,
        accuracy: accuracy.status === "fulfilled" ? accuracy.value : null,
        ranking: ranking.status === "fulfilled" ? ranking.value : null,
        alertsSummary: alertsSummary.status === "fulfilled" ? alertsSummary.value : null,
      };

      const hasAnyProfileData =
        Boolean(nextState.latest) ||
        Boolean(nextState.summary) ||
        Boolean(nextState.rejected) ||
        Boolean(nextState.accuracy) ||
        Boolean(nextState.ranking) ||
        Boolean(nextState.alertsSummary);

      setProfileState({
        ...nextState,
        error: hasAnyProfileData ? null : "profileUnavailable",
      });
    }

    loadPlantProfile();

    return () => {
      mounted = false;
    };
  }, [selectedPlantId, period.from, period.to, profileRefreshToken]);

  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId) || null;
  const rankingProviders = profileState.ranking?.providers || [];
  const rankedProviders = rankingProviders.filter(
    (provider) => provider.avg_mape !== null && !Number.isNaN(provider.avg_mape),
  );
  const bestProvider = rankedProviders[0];
  const topRejectedReason = profileState.rejected?.items
    ? [...profileState.rejected.items].sort((first, second) => second.count - first.count)[0]
    : undefined;
  const activeAlerts = profileState.alertsSummary?.active_alerts ?? 0;
  const criticalAlerts = profileState.alertsSummary?.critical ?? 0;
  const sectionLoading = loading || profileState.loading;
  const stationDataFileSize =
    stationDataFile?.size !== undefined
      ? t("solarPlantProfile.upload.fileSizeValue", {
          value: formatNumber(stationDataFile.size / 1024, 1, noData, locale),
        })
      : noData;
  const stationDataFileType = stationDataFile?.type || t("solarPlantProfile.upload.unknownType");

  const handleTelemetryCsvImport = async () => {
    if (!selectedPlantId || !stationDataFile) {
      setUploadError(t("solarPlantProfile.upload.validationError"));
      return;
    }

    setUploadingTelemetry(true);
    setUploadResult(null);
    setUploadError(null);
    setUploadMessage({ type: "info", text: t("solarPlantProfile.upload.started") });

    const formData = new FormData();
    formData.append("file", stationDataFile);
    formData.append("solar_plant_id", selectedPlantId);

    try {
      const response = await fetch(buildUrl("/api/v1/actual-generation/import-csv"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let detail = t("solarPlantProfile.upload.error");
        try {
          const payload = (await response.json()) as { detail?: string };
          detail = payload.detail ? `${t("solarPlantProfile.upload.error")}: ${payload.detail}` : detail;
        } catch {
          detail = t("solarPlantProfile.upload.error");
        }
        throw new Error(detail);
      }

      const result = (await response.json()) as TelemetryCsvImportResponse;
      const lastImportSummary: LastCsvImportSummary = {
        fileName: stationDataFile.name,
        importedRows: result.imported_rows,
        rejectedRows: result.rejected_rows,
        importedAt: new Date().toISOString(),
        plantId: selectedPlantId,
        plantName: selectedPlant?.name,
      };
      setUploadResult(result);
      setLastActualImport(lastImportSummary);
      writeLastCsvImportSummary(lastActualCsvImportStorageKey, lastImportSummary);
      setUploadMessage({ type: "success", text: t("solarPlantProfile.upload.success") });
      setStationDataFile(null);
      setProfileRefreshToken((current) => current + 1);
    } catch (error) {
      setUploadMessage(null);
      setUploadError(error instanceof Error ? error.message : t("solarPlantProfile.upload.error"));
    } finally {
      setUploadingTelemetry(false);
    }
  };

  return (
    <section className="section-stack">
      {plants.length === 0 && !loading ? (
        <EmptyState
          detail={t("solarPlantProfile.empty.noPlantsDetail")}
          title={t("solarPlantProfile.empty.noPlantsTitle")}
        />
      ) : null}

      <Panel eyebrow={t("solarPlantProfile.selector.eyebrow")} title={t("solarPlantProfile.selector.title")}>
        <div className="plant-profile-selector">
          <label>
            <span>{t("solarPlantProfile.selector.label")}</span>
            <select
              disabled={plants.length === 0}
              onChange={(event) => onSelectedPlantIdChange(event.target.value)}
              value={selectedPlantId}
            >
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </label>
          <small>{t("solarPlantProfile.selector.helper")}</small>
        </div>
      </Panel>

      {profileState.error ? (
        <EmptyState
          detail={t("solarPlantProfile.empty.profileUnavailableDetail")}
          title={t("solarPlantProfile.empty.profileUnavailableTitle")}
        />
      ) : null}

      <section className="plant-profile-layout">
        <Panel eyebrow={t("solarPlantProfile.general.eyebrow")} title={t("solarPlantProfile.general.title")}>
          <div className="profile-detail-grid">
            <div>
              <span>{t("solarPlantProfile.general.name")}</span>
              <strong>{selectedPlant?.name || noData}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.general.id")}</span>
              <strong>{selectedPlant?.id || noData}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.general.status")}</span>
              <strong>{translateStatusLabel(selectedPlant?.status, t, noData)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.general.capacity")}</span>
              <strong>{selectedPlant ? formatCapacityMw(selectedPlant.capacity_kw, noData, locale) : noData}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.general.dataProvider")}</span>
              <strong>{translateTelemetrySource(profileState.latest?.source, t, noData)}</strong>
            </div>
          </div>
        </Panel>

        <Panel eyebrow={t("solarPlantProfile.operational.eyebrow")} title={t("solarPlantProfile.operational.title")}>
          <div className="profile-detail-grid">
            <div>
              <span>{t("solarPlantProfile.operational.lastTelemetry")}</span>
              <strong>{formatDateTime(profileState.summary?.last_telemetry_time ?? profileState.latest?.timestamp, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.operational.currentPower")}</span>
              <strong>
                {formatTranslatedUnit(
                  profileState.summary?.current_power_kw ?? profileState.latest?.actual_power_kw,
                  "telemetry.units.kw",
                  t,
                  noData,
                  1,
                  locale,
                )}
              </strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.operational.telemetryPoints")}</span>
              <strong>{formatNumber(profileState.summary?.telemetry_points_count, 0, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.operational.freshness")}</span>
              <strong>
                {profileState.summary?.data_freshness_status
                  ? t(`telemetry.freshness.${profileState.summary.data_freshness_status}`)
                  : noData}
              </strong>
            </div>
          </div>
          {!sectionLoading && selectedPlant && !profileState.summary ? (
            <EmptyState
              detail={t("solarPlantProfile.empty.telemetryDetail")}
              title={t("solarPlantProfile.empty.telemetryTitle")}
            />
          ) : null}
        </Panel>
      </section>

      <section className="plant-profile-layout">
        <Panel eyebrow={t("solarPlantProfile.forecast.eyebrow")} title={t("solarPlantProfile.forecast.title")}>
          <div className="profile-detail-grid">
            <div>
              <span>{t("solarPlantProfile.forecast.currentMape")}</span>
              <strong>{formatPercent(profileState.accuracy?.avg_mape, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.forecast.bestProvider")}</span>
              <strong>{translateProviderName(bestProvider?.provider_name, bestProvider?.provider_code, t, noData)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.forecast.baselineMape")}</span>
              <strong>{t("forecastInsights.kpi.baselineValue")}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.forecast.targetMape")}</span>
              <strong>{t("forecastInsights.kpi.targetValue")}</strong>
            </div>
          </div>
          {!sectionLoading && selectedPlant && !profileState.accuracy ? (
            <EmptyState
              detail={t("solarPlantProfile.empty.forecastDetail")}
              title={t("solarPlantProfile.empty.forecastTitle")}
            />
          ) : null}
        </Panel>

        <Panel eyebrow={t("solarPlantProfile.dataQuality.eyebrow")} title={t("solarPlantProfile.dataQuality.title")}>
          <div className="profile-detail-grid">
            <div>
              <span>{t("solarPlantProfile.dataQuality.rejectedCount")}</span>
              <strong>{formatNumber(profileState.rejected?.total, 0, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.dataQuality.topReason")}</span>
              <strong>{translateRejectionReason(topRejectedReason?.reason, t, noData)}</strong>
            </div>
          </div>
          {!sectionLoading && selectedPlant && !profileState.rejected ? (
            <EmptyState
              detail={t("solarPlantProfile.empty.dataQualityDetail")}
              title={t("solarPlantProfile.empty.dataQualityTitle")}
            />
          ) : null}
        </Panel>
      </section>

      <section className="plant-profile-layout">
        <Panel eyebrow={t("solarPlantProfile.alerts.eyebrow")} title={t("solarPlantProfile.alerts.title")}>
          <div className="profile-detail-grid">
            <div>
              <span>{t("solarPlantProfile.alerts.activeAlerts")}</span>
              <strong>{formatNumber(activeAlerts, 0, noData, locale)}</strong>
            </div>
            <div>
              <span>{t("solarPlantProfile.alerts.criticalAlerts")}</span>
              <strong>{formatNumber(criticalAlerts, 0, noData, locale)}</strong>
            </div>
          </div>
        </Panel>

        <Panel eyebrow={t("solarPlantProfile.upload.eyebrow")} title={t("solarPlantProfile.upload.title")}>
          <div className="station-upload-card">
            <p>{t("solarPlantProfile.upload.helper")}</p>
            <label className="station-upload-button">
              <span>{t("solarPlantProfile.upload.button")}</span>
              <input
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={uploadingTelemetry}
                onChange={(event) => {
                  setStationDataFile(event.target.files?.[0] || null);
                  setUploadResult(null);
                  setUploadError(null);
                  setUploadMessage(null);
                }}
                type="file"
              />
            </label>
            {stationDataFile ? (
              <div className="station-upload-file">
                <div>
                  <span>{t("solarPlantProfile.upload.fileName")}</span>
                  <strong>{stationDataFile.name}</strong>
                </div>
                <div>
                  <span>{t("solarPlantProfile.upload.fileSize")}</span>
                  <strong>{stationDataFileSize}</strong>
                </div>
                <div>
                  <span>{t("solarPlantProfile.upload.fileType")}</span>
                  <strong>{stationDataFileType}</strong>
                </div>
              </div>
            ) : (
              <EmptyState
                detail={t("solarPlantProfile.upload.emptyDetail")}
                title={t("solarPlantProfile.upload.emptyTitle")}
              />
            )}
            {stationDataFile ? (
              <div className="station-upload-actions">
                <button
                  className="station-upload-submit"
                  disabled={!selectedPlant || uploadingTelemetry}
                  onClick={handleTelemetryCsvImport}
                  type="button"
                >
                  {uploadingTelemetry ? t("solarPlantProfile.upload.importing") : t("solarPlantProfile.upload.import")}
                </button>
              </div>
            ) : null}
            {uploadMessage ? (
              <div className={`station-upload-message ${uploadMessage.type}`}>{uploadMessage.text}</div>
            ) : null}
            {uploadResult ? (
              <div className="station-upload-message success">
                {t("solarPlantProfile.upload.resultSummary", {
                  imported: formatNumber(uploadResult.imported_rows, 0, noData, locale),
                  rejected: formatNumber(uploadResult.rejected_rows, 0, noData, locale),
                })}
              </div>
            ) : null}
            {lastActualImport ? (
              <div className="station-upload-last">
                <span>{t("solarPlantProfile.upload.lastImportedFile")}</span>
                <strong>{lastActualImport.fileName}</strong>
                <div>
                  <span>
                    {t("solarPlantProfile.upload.lastImportedRows", {
                      imported: formatNumber(lastActualImport.importedRows, 0, noData, locale),
                      rejected: formatNumber(lastActualImport.rejectedRows, 0, noData, locale),
                    })}
                  </span>
                  <span>
                    {t("solarPlantProfile.upload.lastImportedAt", {
                      time: formatDateTime(lastActualImport.importedAt, noData, locale),
                    })}
                  </span>
                </div>
                <p>{t("solarPlantProfile.upload.actualStoredDetail")}</p>
              </div>
            ) : profileState.summary && profileState.summary.telemetry_points_count > 0 ? (
              <div className="station-upload-last">
                <span>{t("solarPlantProfile.upload.dataAvailableTitle")}</span>
                <p>{t("solarPlantProfile.upload.dataAvailableDetail")}</p>
              </div>
            ) : null}
            {uploadError ? <div className="station-upload-message error">{uploadError}</div> : null}
            {uploadResult?.errors.length ? (
              <div className="station-upload-message warning">
                {uploadResult.errors.slice(0, 3).map((error) => (
                  <span key={`${error.row_number}-${error.message}`}>
                    {error.row_number
                      ? t("solarPlantProfile.upload.rowError", {
                          row: error.row_number,
                          message: error.message,
                        })
                      : error.message}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel eyebrow={t("solarPlantProfile.timeline.eyebrow")} title={t("solarPlantProfile.timeline.title")}>
          <EmptyState
            detail={t("solarPlantProfile.timeline.placeholderDetail")}
            title={t("solarPlantProfile.timeline.placeholderTitle")}
          />
        </Panel>
      </section>
    </section>
  );
}

function ForecastInsightsSection({
  summary,
  ranking,
  forecastRuns,
  telemetrySummary,
  plants,
  loading,
  locale,
  t,
}: {
  summary: AccuracySummary | null;
  ranking: AccuracyProviderRankingResponse | null;
  forecastRuns: ForecastRun[];
  telemetrySummary: TelemetrySummary | null;
  plants: SolarPlant[];
  loading: boolean;
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const notEnoughData = t("forecastInsights.common.notEnoughData");
  const rankingProviders = ranking?.providers || [];
  const rankedProviders = rankingProviders.filter(
    (provider) => provider.avg_mape !== null && !Number.isNaN(provider.avg_mape),
  );
  const bestProvider = rankedProviders[0];
  const currentMape = summary?.avg_mape ?? null;
  const improvement =
    currentMape === null || Number.isNaN(currentMape)
      ? null
      : ((forecastBaselineMape - currentMape) / forecastBaselineMape) * 100;
  const targetStatus =
    currentMape === null || Number.isNaN(currentMape)
      ? "noData"
      : currentMape < forecastTargetMape
        ? "below"
        : "above";
  const avgBias = summary?.avg_bias ?? null;
  const hasBias = avgBias !== null && !Number.isNaN(avgBias);
  const biasTone = !hasBias
    ? "noData"
    : Math.abs(avgBias || 0) < 0.1
      ? "neutral"
      : (avgBias || 0) > 0
        ? "positive"
        : "negative";
  const pilotPlant =
    plants.find((plant) => plant.name.toLowerCase().includes("varvar")) || plants[0] || null;

  return (
    <section className="section-stack">
      {!loading && !summary ? (
        <EmptyState
          detail={t("forecastInsights.empty.unavailableDetail")}
          title={t("forecastInsights.empty.unavailableTitle")}
        />
      ) : null}

      <section className="metric-grid forecast-insights-metric-grid">
        <MetricCard
          helper={t(`forecastInsights.kpi.currentMapeHelper.${targetStatus}`)}
          label={t("forecastInsights.kpi.currentMape")}
          loading={loading}
          t={t}
          value={formatPercent(currentMape, noData, locale)}
        />
        <MetricCard
          helper={t("forecastInsights.kpi.baselineHelper")}
          label={t("forecastInsights.kpi.baseline")}
          loading={loading}
          t={t}
          value={t("forecastInsights.kpi.baselineValue")}
        />
        <MetricCard
          helper={t("forecastInsights.kpi.targetHelper")}
          label={t("forecastInsights.kpi.target")}
          loading={loading}
          t={t}
          value={t("forecastInsights.kpi.targetValue")}
        />
        <MetricCard
          helper={t("forecastInsights.kpi.improvementHelper")}
          label={t("forecastInsights.kpi.improvement")}
          loading={loading}
          t={t}
          value={formatSignedPercent(improvement, noData, locale)}
        />
        <MetricCard
          helper={t("forecastInsights.kpi.bestProviderHelper")}
          label={t("forecastInsights.kpi.bestProvider")}
          loading={loading}
          t={t}
          value={translateProviderName(bestProvider?.provider_name, bestProvider?.provider_code, t, noData)}
          valueClassName="metric-value-text"
        />
        <MetricCard
          helper={t("forecastInsights.kpi.daysBelowTargetHelper")}
          label={t("forecastInsights.kpi.daysBelowTarget")}
          loading={loading}
          t={t}
          value={notEnoughData}
          valueClassName="metric-value-text"
        />
      </section>

      <section className="forecast-insights-layout">
        <Panel eyebrow={t("forecastInsights.trend.eyebrow")} title={t("forecastInsights.trend.title")}>
          <EmptyState
            detail={t("forecastInsights.trend.emptyDetail")}
            title={t("forecastInsights.trend.emptyTitle")}
          />
          <div className="forecast-thresholds">
            <div>
              <span>{t("forecastInsights.trend.baseline")}</span>
              <strong>{t("forecastInsights.kpi.baselineValue")}</strong>
            </div>
            <div>
              <span>{t("forecastInsights.trend.target")}</span>
              <strong>{t("forecastInsights.kpi.targetValue")}</strong>
            </div>
          </div>
        </Panel>

        <Panel eyebrow={t("forecastInsights.summary.eyebrow")} title={t("forecastInsights.summary.title")}>
          {loading ? (
            <EmptyState
              detail={t("forecastInsights.loading.summaryDetail")}
              title={t("forecastInsights.loading.summaryTitle")}
            />
          ) : (
            <div className="forecast-insights-summary">
              <div>
                <span>{t("forecastInsights.summary.pilotAsset")}</span>
                <strong>{pilotPlant?.name || noData}</strong>
              </div>
              <div>
                <span>{t("forecastInsights.summary.currentVsBaseline")}</span>
                <strong>
                  {currentMape === null || Number.isNaN(currentMape)
                    ? notEnoughData
                    : t("forecastInsights.summary.currentVsBaselineValue", {
                        current: formatPercent(currentMape, noData, locale),
                        baseline: t("forecastInsights.kpi.baselineValue"),
                      })}
                </strong>
              </div>
              <div>
                <span>{t("forecastInsights.summary.targetStatus")}</span>
                <strong>{t(`forecastInsights.summary.targetStatusValue.${targetStatus}`)}</strong>
              </div>
              <div>
                <span>{t("forecastInsights.summary.bestProvider")}</span>
                <strong>{translateProviderName(bestProvider?.provider_name, bestProvider?.provider_code, t, noData)}</strong>
              </div>
              <div>
                <span>{t("forecastInsights.summary.bias")}</span>
                <strong>
                  {hasBias
                    ? t(`forecastInsights.summary.biasValue.${biasTone}`, {
                        value: formatNumber(avgBias, 2, noData, locale),
                      })
                    : notEnoughData}
                </strong>
              </div>
              <div>
                <span>{t("forecastInsights.summary.dataCoverage")}</span>
                <strong>
                  {t("forecastInsights.summary.dataCoverageValue", {
                    runs: formatNumber(summary?.forecast_runs_count ?? forecastRuns.length, 0, noData, locale),
                    samples: formatNumber(summary?.samples_count, 0, noData, locale),
                    telemetry: formatNumber(telemetrySummary?.telemetry_points_count, 0, noData, locale),
                  })}
                </strong>
              </div>
            </div>
          )}
        </Panel>
      </section>

      <Panel eyebrow={t("forecastInsights.providers.eyebrow")} title={t("forecastInsights.providers.title")}>
        {loading ? (
          <EmptyState
            detail={t("forecastInsights.loading.providersDetail")}
            title={t("forecastInsights.loading.providersTitle")}
          />
        ) : rankingProviders.length > 0 ? (
          <div className="forecast-insights-provider-table">
            <div className="forecast-insights-provider-head">
              <span>{t("forecastInsights.providers.provider")}</span>
              <span>{t("forecastInsights.providers.mape")}</span>
              <span>{t("forecastInsights.providers.rmse")}</span>
              <span>{t("forecastInsights.providers.mae")}</span>
              <span>{t("forecastInsights.providers.bias")}</span>
              <span>{t("forecastInsights.providers.samples")}</span>
            </div>
            {rankingProviders.map((provider) => (
              <div className="forecast-insights-provider-row" key={provider.provider_id}>
                <span>
                  <strong>{translateProviderName(provider.provider_name, provider.provider_code, t, noData)}</strong>
                </span>
                <span>{formatPercent(provider.avg_mape, noData, locale)}</span>
                <span>{formatNumber(provider.avg_rmse, 2, noData, locale)}</span>
                <span>{formatNumber(provider.avg_mae, 2, noData, locale)}</span>
                <span>{formatNumber(provider.avg_bias, 2, noData, locale)}</span>
                <span>{formatNumber(provider.samples_count, 0, noData, locale)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            detail={t("forecastInsights.providers.emptyDetail")}
            title={t("forecastInsights.providers.emptyTitle")}
          />
        )}
      </Panel>
    </section>
  );
}

function ForecastAccuracyLabSection({
  plants,
  summary,
  ranking,
  loading,
  locale,
  onImportComplete,
  t,
}: {
  plants: SolarPlant[];
  summary: AccuracySummary | null;
  ranking: AccuracyProviderRankingResponse | null;
  loading: boolean;
  locale: Locale;
  onImportComplete: () => void;
  t: Translate;
}) {
  const noData = t("common.noData");
  const targetStatus = getAccuracyTargetStatus(summary?.avg_mape);
  const rankingProviders = ranking?.providers || [];
  const hasAggregates = Boolean(summary && summary.aggregates_count > 0);
  const [forecastPlantId, setForecastPlantId] = useState("");
  const [forecastCsvFile, setForecastCsvFile] = useState<File | null>(null);
  const [forecastImporting, setForecastImporting] = useState(false);
  const [forecastImportResult, setForecastImportResult] = useState<TelemetryCsvImportResponse | null>(null);
  const [forecastImportError, setForecastImportError] = useState<string | null>(null);
  const [forecastImportMessage, setForecastImportMessage] = useState<{
    type: "info" | "success";
    text: string;
  } | null>(null);
  const [lastForecastImport, setLastForecastImport] = useState<LastCsvImportSummary | null>(null);

  useEffect(() => {
    setLastForecastImport(readLastCsvImportSummary(lastForecastCsvImportStorageKey));
  }, []);

  useEffect(() => {
    if (plants.length === 0) {
      setForecastPlantId("");
      return;
    }
    if (!forecastPlantId || !plants.some((plant) => plant.id === forecastPlantId)) {
      setForecastPlantId(plants[0].id);
    }
  }, [forecastPlantId, plants]);

  const forecastCsvFileSize =
    forecastCsvFile?.size !== undefined
      ? t("solarPlantProfile.upload.fileSizeValue", {
          value: formatNumber(forecastCsvFile.size / 1024, 1, noData, locale),
        })
      : noData;
  const forecastCsvFileType = forecastCsvFile?.type || t("solarPlantProfile.upload.unknownType");

  const handleForecastCsvImport = async () => {
    if (!forecastPlantId || !forecastCsvFile) {
      setForecastImportError(t("accuracyLab.forecastImport.validation.selectFileAndPlant"));
      return;
    }

    setForecastImporting(true);
    setForecastImportResult(null);
    setForecastImportError(null);
    setForecastImportMessage({ type: "info", text: t("accuracyLab.forecastImport.started") });

    const formData = new FormData();
    formData.append("file", forecastCsvFile);
    formData.append("plant_id", forecastPlantId);

    try {
      const response = await fetch(buildUrl("/api/v1/forecast-runs/import-csv"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(t("accuracyLab.forecastImport.error"));
      }

      const result = (await response.json()) as TelemetryCsvImportResponse;
      const selectedPlant = plants.find((plant) => plant.id === forecastPlantId);
      const lastImportSummary: LastCsvImportSummary = {
        fileName: forecastCsvFile.name,
        importedRows: result.imported_rows,
        rejectedRows: result.rejected_rows,
        importedAt: new Date().toISOString(),
        plantId: forecastPlantId,
        plantName: selectedPlant?.name,
        providerCode: "manual_csv_forecast",
      };
      setForecastImportResult(result);
      setLastForecastImport(lastImportSummary);
      writeLastCsvImportSummary(lastForecastCsvImportStorageKey, lastImportSummary);
      setForecastImportMessage({ type: "success", text: t("accuracyLab.forecastImport.success") });
      setForecastCsvFile(null);
      onImportComplete();
    } catch (error) {
      setForecastImportMessage(null);
      setForecastImportError(
        error instanceof Error ? error.message : t("accuracyLab.forecastImport.error"),
      );
    } finally {
      setForecastImporting(false);
    }
  };

  return (
    <section className="section-stack">
      {!loading && !summary ? (
        <EmptyState
          detail={t("accuracyLab.unavailableDetail")}
          title={t("accuracyLab.unavailableTitle")}
        />
      ) : null}

      <section className="metric-grid accuracy-lab-metric-grid">
        <MetricCard
          helper={t("accuracyLab.kpi.avgMapeHelper")}
          label={t("accuracyLab.kpi.avgMape")}
          loading={loading}
          t={t}
          value={formatPercent(summary?.avg_mape, noData, locale)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.avgRmseHelper")}
          label={t("accuracyLab.kpi.avgRmse")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.avg_rmse, 2, noData, locale)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.avgMaeHelper")}
          label={t("accuracyLab.kpi.avgMae")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.avg_mae, 2, noData, locale)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.avgBiasHelper")}
          label={t("accuracyLab.kpi.avgBias")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.avg_bias, 2, noData, locale)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.samplesHelper")}
          label={t("accuracyLab.kpi.samples")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.samples_count, 0, noData, locale)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.forecastRunsHelper")}
          label={t("accuracyLab.kpi.forecastRuns")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.forecast_runs_count, 0, noData, locale)}
        />
      </section>

      <Panel
        eyebrow={t("accuracyLab.forecastImport.eyebrow")}
        title={t("accuracyLab.forecastImport.title")}
      >
        <div className="station-upload-card">
          <p>{t("accuracyLab.forecastImport.helper")}</p>
          <div className="plant-profile-selector">
            <label>
              <span>{t("accuracyLab.forecastImport.plantLabel")}</span>
              <select
                disabled={plants.length === 0 || forecastImporting}
                onChange={(event) => setForecastPlantId(event.target.value)}
                value={forecastPlantId}
              >
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))}
              </select>
            </label>
            <small>{t("accuracyLab.forecastImport.plantHelper")}</small>
          </div>
          <label className="station-upload-button">
            <span>{t("accuracyLab.forecastImport.chooseButton")}</span>
            <input
              accept=".csv,text/csv"
              disabled={forecastImporting}
              onChange={(event) => {
                setForecastCsvFile(event.target.files?.[0] || null);
                setForecastImportResult(null);
                setForecastImportError(null);
                setForecastImportMessage(null);
              }}
              type="file"
            />
          </label>
          {forecastCsvFile ? (
            <div className="station-upload-file">
              <div>
                <span>{t("solarPlantProfile.upload.fileName")}</span>
                <strong>{forecastCsvFile.name}</strong>
              </div>
              <div>
                <span>{t("solarPlantProfile.upload.fileSize")}</span>
                <strong>{forecastCsvFileSize}</strong>
              </div>
              <div>
                <span>{t("solarPlantProfile.upload.fileType")}</span>
                <strong>{forecastCsvFileType}</strong>
              </div>
            </div>
          ) : null}
          {forecastCsvFile ? (
            <div className="station-upload-actions">
              <button
                className="station-upload-submit"
                disabled={!forecastPlantId || forecastImporting}
                onClick={handleForecastCsvImport}
                type="button"
              >
                {forecastImporting
                  ? t("accuracyLab.forecastImport.importing")
                  : t("accuracyLab.forecastImport.import")}
              </button>
            </div>
          ) : null}
          {forecastImportMessage ? (
            <div className={`station-upload-message ${forecastImportMessage.type}`}>
              {forecastImportMessage.text}
            </div>
          ) : null}
          {forecastImportResult ? (
            <div className="station-upload-message success">
              {t("accuracyLab.forecastImport.resultSummary", {
                imported: formatNumber(forecastImportResult.imported_rows, 0, noData, locale),
                rejected: formatNumber(forecastImportResult.rejected_rows, 0, noData, locale),
              })}
            </div>
          ) : null}
          {lastForecastImport ? (
            <div className="station-upload-last">
              <span>{t("accuracyLab.forecastImport.lastImportedFile")}</span>
              <strong>{lastForecastImport.fileName}</strong>
              <div>
                <span>
                  {t("accuracyLab.forecastImport.lastImportedRows", {
                    imported: formatNumber(lastForecastImport.importedRows, 0, noData, locale),
                    rejected: formatNumber(lastForecastImport.rejectedRows, 0, noData, locale),
                  })}
                </span>
                <span>
                  {t("accuracyLab.forecastImport.lastImportedProvider", {
                    provider: translateProviderName(
                      "Manual CSV / Forecast provider",
                      lastForecastImport.providerCode,
                      t,
                      noData,
                    ),
                  })}
                </span>
                <span>
                  {t("accuracyLab.forecastImport.lastImportedAt", {
                    time: formatDateTime(lastForecastImport.importedAt, noData, locale),
                  })}
                </span>
              </div>
              <p>{t("accuracyLab.forecastImport.forecastStoredDetail")}</p>
            </div>
          ) : hasAggregates || (summary?.forecast_runs_count ?? 0) > 0 ? (
            <div className="station-upload-last">
              <span>{t("accuracyLab.forecastImport.dataAvailableTitle")}</span>
              <p>{t("accuracyLab.forecastImport.dataAvailableDetail")}</p>
            </div>
          ) : null}
          {forecastImportError ? (
            <div className="station-upload-message error">{forecastImportError}</div>
          ) : null}
          {forecastImportResult?.errors.length ? (
            <div className="station-upload-message warning">
              {forecastImportResult.errors.slice(0, 3).map((error) => (
                <span key={`${error.row_number}-${error.message}`}>
                  {error.row_number
                    ? t("accuracyLab.forecastImport.rowError", {
                        row: error.row_number,
                        message: translateForecastImportError(error.message, t, error.message),
                      })
                    : translateForecastImportError(error.message, t, error.message)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>

      <section className="accuracy-lab-layout">
        <Panel eyebrow={t("accuracyLab.target.eyebrow")} title={t("accuracyLab.target.title")}>
          <div className="target-card">
            <div className={`target-status ${targetStatus}`}>
              <span>{t("accuracyLab.target.currentMape")}</span>
              <strong>{formatPercent(summary?.avg_mape, noData, locale)}</strong>
              <em>{t(`accuracyLab.target.status.${targetStatus}`)}</em>
            </div>
            <div className="target-grid">
              <div>
                <span>{t("accuracyLab.target.baseline")}</span>
                <strong>14%</strong>
              </div>
              <div>
                <span>{t("accuracyLab.target.target")}</span>
                <strong>&lt;10%</strong>
              </div>
              <div>
                <span>{t("accuracyLab.target.excellent")}</span>
                <strong>&lt;5%</strong>
              </div>
            </div>
            {!loading && summary && !hasAggregates ? (
              <EmptyState
                detail={t("accuracyLab.noAggregatesDetail")}
                title={t("accuracyLab.noAggregatesTitle")}
              />
            ) : null}
          </div>
        </Panel>

        <Panel eyebrow={t("accuracyLab.ranking.eyebrow")} title={t("accuracyLab.ranking.title")}>
          {loading ? (
            <EmptyState
              detail={t("accuracyLab.ranking.loadingDetail")}
              title={t("accuracyLab.ranking.loadingTitle")}
            />
          ) : !ranking ? (
            <EmptyState
              detail={t("accuracyLab.ranking.unavailableDetail")}
              title={t("accuracyLab.ranking.unavailableTitle")}
            />
          ) : rankingProviders.length > 0 ? (
            <div className="ranking-table">
              <div className="ranking-table-head">
                <span>{t("accuracyLab.ranking.rank")}</span>
                <span>{t("accuracyLab.ranking.provider")}</span>
                <span>{t("accuracyLab.ranking.avgMape")}</span>
                <span>{t("accuracyLab.ranking.avgRmse")}</span>
                <span>{t("accuracyLab.ranking.avgMae")}</span>
                <span>{t("accuracyLab.ranking.avgBias")}</span>
                <span>{t("accuracyLab.ranking.samples")}</span>
                <span>{t("accuracyLab.ranking.forecastRuns")}</span>
              </div>
              {rankingProviders.map((provider) => (
                <div className="ranking-table-row" key={provider.provider_id}>
                  <strong>#{provider.rank}</strong>
                  <span>
                    <strong>{translateProviderName(provider.provider_name, provider.provider_code, t, noData)}</strong>
                  </span>
                  <span>{formatPercent(provider.avg_mape, noData, locale)}</span>
                  <span>{formatNumber(provider.avg_rmse, 2, noData, locale)}</span>
                  <span>{formatNumber(provider.avg_mae, 2, noData, locale)}</span>
                  <span>{formatNumber(provider.avg_bias, 2, noData, locale)}</span>
                  <span>{formatNumber(provider.samples_count, 0, noData, locale)}</span>
                  <span>{formatNumber(provider.forecast_runs_count, 0, noData, locale)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              detail={t("accuracyLab.ranking.emptyDetail")}
              title={t("accuracyLab.ranking.emptyTitle")}
            />
          )}
        </Panel>
      </section>
    </section>
  );
}

type ForecastProviderRow = {
  id: string;
  name: string;
  code: string;
  providerType: string;
  status: string;
  dataStatus: string;
  latestForecastAt: string | null;
  latestAccuracyMape: number | null;
  baselineMape: number | null;
  targetMape: number;
  notes: string;
  recommendedAction: string;
  forecastRunsCount: number;
};

function buildForecastProviderRows(providers: ForecastProvider[]) {
  return providers.map<ForecastProviderRow>((provider) => {
    const status = provider.status || (provider.is_active ? "active" : "inactive");
    return {
      id: provider.id,
      name: provider.name,
      code: provider.code,
      providerType: provider.provider_type || "unknown",
      status,
      dataStatus: provider.data_status || "unknown",
      latestForecastAt: provider.latest_forecast_at || null,
      latestAccuracyMape: provider.latest_accuracy_mape ?? null,
      baselineMape: provider.baseline_mape ?? null,
      targetMape: provider.target_mape ?? forecastTargetMape,
      notes: provider.notes || "actuals_reference_empty",
      recommendedAction: provider.recommended_action || "no_data",
      forecastRunsCount: provider.forecast_runs_count ?? 0,
    };
  });
}

function ForecastProvidersSection({
  providers,
  loading,
  locale,
  t,
}: {
  providers: ForecastProvider[];
  loading: boolean;
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const rows = buildForecastProviderRows(providers);
  const activeProviders = rows.filter(
    (provider) => normalizeMachineValue(provider.status) === "active",
  ).length;
  const totalForecastRuns = rows.reduce(
    (sum, provider) => sum + (provider.forecastRunsCount || 0),
    0,
  );
  const bestProvider = rows
    .filter(
      (provider) =>
        normalizeMachineValue(provider.dataStatus) === "connected" &&
        provider.latestAccuracyMape !== null &&
        !Number.isNaN(provider.latestAccuracyMape),
    )
    .sort((first, second) => (first.latestAccuracyMape || 0) - (second.latestAccuracyMape || 0))[0];

  return (
    <section className="section-stack">
      {!loading && providers.length === 0 ? (
        <EmptyState detail={t("providers.emptyDetail")} title={t("providers.emptyTitle")} />
      ) : null}

      <section className="metric-grid providers-metric-grid">
        <MetricCard
          helper={t("forecastProviders.kpi.totalProvidersHelper")}
          label={t("forecastProviders.kpi.totalProviders")}
          loading={loading}
          t={t}
          value={formatNumber(providers.length, 0, noData, locale)}
        />
        <MetricCard
          helper={t("forecastProviders.kpi.activeProvidersHelper")}
          label={t("forecastProviders.kpi.activeProviders")}
          loading={loading}
          t={t}
          value={formatNumber(activeProviders, 0, noData, locale)}
        />
        <MetricCard
          helper={t("forecastProviders.kpi.forecastRunsHelper")}
          label={t("forecastProviders.kpi.forecastRuns")}
          loading={loading}
          t={t}
          value={formatNumber(totalForecastRuns, 0, noData, locale)}
        />
        <MetricCard
          helper={t("forecastProviders.kpi.bestProviderHelper")}
          label={t("forecastProviders.kpi.bestProvider")}
          loading={loading}
          t={t}
          value={translateProviderName(bestProvider?.name, bestProvider?.code, t, noData)}
        />
      </section>

      <section className="providers-layout">
        <Panel eyebrow={t("forecastProviders.table.eyebrow")} title={t("forecastProviders.table.title")}>
          {loading ? (
            <EmptyState detail={t("providers.loadingDetail")} title={t("providers.loadingTitle")} />
          ) : rows.length > 0 ? (
            <div className="providers-table">
              <div className="providers-table-head">
                <span>{t("forecastProviders.table.name")}</span>
                <span>{t("forecastProviders.table.type")}</span>
                <span>{t("forecastProviders.table.status")}</span>
                <span>{t("forecastProviders.table.dataStatus")}</span>
                <span>{t("forecastProviders.table.latestForecast")}</span>
                <span>{t("forecastProviders.table.latestMape")}</span>
                <span>{t("forecastProviders.table.forecastRuns")}</span>
                <span>{t("forecastProviders.table.targetMape")}</span>
              </div>
              {rows.map((provider) => (
                <div className="providers-table-row" key={provider.id}>
                  <strong>{translateProviderName(provider.name, provider.code, t, noData)}</strong>
                  <span>{translateProviderType(provider.providerType, t, noData)}</span>
                  <span>{translateProviderStatus(provider.status, t, noData)}</span>
                  <span>{translateProviderDataStatus(provider.dataStatus, t, noData)}</span>
                  <span>{formatDateTime(provider.latestForecastAt, noData, locale)}</span>
                  <span>{formatPercent(provider.latestAccuracyMape, noData, locale)}</span>
                  <span>{formatNumber(provider.forecastRunsCount, 0, noData, locale)}</span>
                  <span>{t("forecastProviders.values.targetMape", {
                    value: formatNumber(provider.targetMape, 0, noData, locale),
                  })}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState detail={t("providers.emptyDetail")} title={t("providers.emptyTitle")} />
          )}
        </Panel>

        <Panel
          eyebrow={t("forecastProviders.cards.eyebrow")}
          title={t("forecastProviders.cards.title")}
        >
          {loading ? (
            <EmptyState detail={t("providers.loadingDetail")} title={t("providers.loadingTitle")} />
          ) : rows.length > 0 ? (
            <div className="provider-card-grid">
              {rows.map((provider) => (
                <article className="provider-card" key={provider.id}>
                  <div className="provider-card-header">
                    <div>
                      <span>{translateProviderType(provider.providerType, t, noData)}</span>
                      <strong>{translateProviderName(provider.name, provider.code, t, noData)}</strong>
                    </div>
                    <ProviderBadge
                      label={translateProviderCompactDataStatus(provider.dataStatus, t, noData)}
                      value={provider.dataStatus}
                    />
                  </div>
                  <div className="provider-card-badges">
                    <ProviderBadge
                      label={translateProviderCompactStatus(provider.status, t, noData)}
                      value={provider.status}
                    />
                    <ProviderBadge
                      label={translateProviderCompactAction(provider.recommendedAction, t, noData)}
                      value={provider.recommendedAction}
                    />
                  </div>
                  <dl className="provider-card-metrics">
                    <div>
                      <dt>{t("forecastProviders.cards.latestForecast")}</dt>
                      <dd>{formatDateTime(provider.latestForecastAt, noData, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("forecastProviders.cards.latestMape")}</dt>
                      <dd>{formatPercent(provider.latestAccuracyMape, noData, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("forecastProviders.cards.baselineMape")}</dt>
                      <dd>{formatPercent(provider.baselineMape, noData, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("forecastProviders.cards.forecastRuns")}</dt>
                      <dd>{formatNumber(provider.forecastRunsCount, 0, noData, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("forecastProviders.cards.targetMape")}</dt>
                      <dd>{t("forecastProviders.values.targetMape", {
                        value: formatNumber(provider.targetMape, 0, noData, locale),
                      })}</dd>
                    </div>
                  </dl>
                  <p>{translateProviderNote(provider.notes, t, noData)}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              detail={t("forecastProviders.cards.emptyDetail")}
              title={t("forecastProviders.cards.emptyTitle")}
            />
          )}
        </Panel>
      </section>
    </section>
  );
}

function QualityStatusBadge({ status, t }: { status: DataQualityStatus; t: Translate }) {
  return (
    <span className={`quality-badge ${status}`}>
      {t(`dataQuality.status.${status}`)}
    </span>
  );
}

function DataQualitySection({
  plants,
  locale,
  t,
}: {
  plants: SolarPlant[];
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const [selectedPeriod, setSelectedPeriod] = useState<DataQualityPeriodKey>("7d");
  const [selectedAssetId, setSelectedAssetId] = useState("all");
  const [selectedReason, setSelectedReason] = useState("all");
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    summary: RejectedTelemetrySummary | null;
    records: RejectedTelemetryRecord[];
    acceptedPoints: number;
  }>({
    loading: true,
    error: null,
    summary: null,
    records: [],
    acceptedPoints: 0,
  });

  useEffect(() => {
    let mounted = true;

    async function loadDataQuality() {
      setState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const range = getDataQualityPeriodRange(selectedPeriod);
      const summaryParams: Record<string, string> = {
        from: range.from,
        to: range.to,
      };
      const listParams: Record<string, string> = {
        from: range.from,
        to: range.to,
        limit: "100",
      };

      if (selectedAssetId !== "all") {
        summaryParams.plant_id = selectedAssetId;
        listParams.plant_id = selectedAssetId;
      }

      if (selectedReason !== "all") {
        listParams.reason = selectedReason;
      }

      const [summaryResult, recordsResult] = await Promise.allSettled([
        fetchJson<RejectedTelemetrySummary>("/api/v1/telemetry/rejected/summary", summaryParams),
        fetchJson<RejectedTelemetryRecord[]>("/api/v1/telemetry/rejected", listParams),
      ]);

      const assetIds =
        selectedAssetId === "all"
          ? plants.map((plant) => plant.id)
          : plants.some((plant) => plant.id === selectedAssetId)
            ? [selectedAssetId]
            : [];

      const acceptedResults = await Promise.allSettled(
        assetIds.map((assetId) =>
          fetchJson<TelemetrySummary>("/api/v1/telemetry/summary", {
            asset_id: assetId,
            from: range.from,
            to: range.to,
          }),
        ),
      );

      if (!mounted) {
        return;
      }

      const acceptedPoints = acceptedResults.reduce(
        (sum, result) =>
          result.status === "fulfilled" ? sum + result.value.telemetry_points_count : sum,
        0,
      );

      setState({
        loading: false,
        error:
          summaryResult.status === "rejected" && recordsResult.status === "rejected"
            ? "apiUnavailable"
            : null,
        summary: summaryResult.status === "fulfilled" ? summaryResult.value : null,
        records: recordsResult.status === "fulfilled" ? recordsResult.value : [],
        acceptedPoints,
      });
    }

    loadDataQuality();

    return () => {
      mounted = false;
    };
  }, [plants, selectedAssetId, selectedPeriod, selectedReason]);

  const selectedSummaryItems =
    selectedReason === "all"
      ? state.summary?.items || []
      : (state.summary?.items || []).filter((item) => item.reason === selectedReason);
  const totalRejected =
    selectedReason === "all"
      ? state.summary?.total ?? state.records.length
      : selectedSummaryItems[0]?.count ?? state.records.length;
  const rejectionDenominator = totalRejected + state.acceptedPoints;
  const rejectionRate =
    rejectionDenominator > 0 ? (totalRejected / rejectionDenominator) * 100 : null;
  const topReason = selectedSummaryItems[0];
  const topReasons = selectedSummaryItems.slice(0, 5);
  const affectedAssets = new Set(
    state.records.map((record) => record.plant_id).filter(Boolean),
  ).size;
  const qualityStatus = getDataQualityStatus(totalRejected, rejectionRate);

  return (
    <section className="section-stack">
      {state.error ? (
        <EmptyState
          detail={t("dataQuality.empty.unavailableDetail")}
          title={t("dataQuality.empty.unavailableTitle")}
        />
      ) : null}

      <Panel eyebrow={t("dataQuality.filters.eyebrow")} title={t("dataQuality.filters.title")}>
        <div className="data-quality-filters">
          <label>
            <span>{t("dataQuality.filters.period")}</span>
            <select
              onChange={(event) => setSelectedPeriod(event.target.value as DataQualityPeriodKey)}
              value={selectedPeriod}
            >
              {dataQualityPeriods.map((period) => (
                <option key={period.key} value={period.key}>
                  {t(`dataQuality.periods.${period.labelKey}`)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t("dataQuality.filters.asset")}</span>
            <select
              onChange={(event) => setSelectedAssetId(event.target.value)}
              value={selectedAssetId}
            >
              <option value="all">{t("dataQuality.filters.allAssets")}</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t("dataQuality.filters.reason")}</span>
            <select
              onChange={(event) => setSelectedReason(event.target.value)}
              value={selectedReason}
            >
              <option value="all">{t("dataQuality.filters.allReasons")}</option>
              {rejectionReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {translateRejectionReason(reason, t, noData)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <section className="metric-grid data-quality-metric-grid">
        <MetricCard
          helper={t("dataQuality.kpi.totalRejectedHelper")}
          label={t("dataQuality.kpi.totalRejected")}
          loading={state.loading}
          t={t}
          value={formatNumber(totalRejected, 0, noData, locale)}
        />
        <MetricCard
          helper={t("dataQuality.kpi.rejectionRateHelper", {
            accepted: formatNumber(state.acceptedPoints, 0, noData, locale),
          })}
          label={t("dataQuality.kpi.rejectionRate")}
          loading={state.loading}
          t={t}
          value={formatPercent(rejectionRate, noData, locale)}
        />
        <MetricCard
          helper={t("dataQuality.kpi.topReasonHelper")}
          label={t("dataQuality.kpi.topReason")}
          loading={state.loading}
          t={t}
          value={translateRejectionReason(topReason?.reason, t, noData)}
          valueClassName="metric-value-text"
        />
        <MetricCard
          helper={t("dataQuality.kpi.affectedAssetsHelper")}
          label={t("dataQuality.kpi.affectedAssets")}
          loading={state.loading}
          t={t}
          value={formatNumber(affectedAssets, 0, noData, locale)}
        />
      </section>

      <section className="data-quality-layout">
        <Panel eyebrow={t("dataQuality.reasons.eyebrow")} title={t("dataQuality.reasons.title")}>
          {state.loading ? (
            <EmptyState
              detail={t("dataQuality.loading.summaryDetail")}
              title={t("dataQuality.loading.summaryTitle")}
            />
          ) : topReasons.length > 0 ? (
            <div className="quality-reason-list">
              {topReasons.map((item) => (
                <div className="quality-reason-row" key={item.reason}>
                  <div>
                    <strong>{translateRejectionReason(item.reason, t, noData)}</strong>
                    <span>{t("dataQuality.reasons.rawCode", { code: item.reason })}</span>
                  </div>
                  <em>{formatNumber(item.count, 0, noData, locale)}</em>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              detail={t("dataQuality.empty.cleanDetail")}
              title={t("dataQuality.empty.cleanTitle")}
            />
          )}
        </Panel>

        <Panel eyebrow={t("dataQuality.statusPanel.eyebrow")} title={t("dataQuality.statusPanel.title")}>
          {state.loading ? (
            <EmptyState
              detail={t("dataQuality.loading.statusDetail")}
              title={t("dataQuality.loading.statusTitle")}
            />
          ) : (
            <div className={`quality-status-card ${qualityStatus}`}>
              <QualityStatusBadge status={qualityStatus} t={t} />
              <strong>{t(`dataQuality.statusDetail.${qualityStatus}`)}</strong>
              <span>
                {t("dataQuality.statusPanel.detail", {
                  rejected: formatNumber(totalRejected, 0, noData, locale),
                  accepted: formatNumber(state.acceptedPoints, 0, noData, locale),
                })}
              </span>
            </div>
          )}
        </Panel>
      </section>

      <Panel eyebrow={t("dataQuality.table.eyebrow")} title={t("dataQuality.table.title")}>
        {state.loading ? (
          <EmptyState
            detail={t("dataQuality.loading.recordsDetail")}
            title={t("dataQuality.loading.recordsTitle")}
          />
        ) : state.records.length > 0 ? (
          <div className="rejected-records-table">
            <div className="rejected-records-head">
              <span>{t("dataQuality.table.receivedAt")}</span>
              <span>{t("dataQuality.table.reason")}</span>
              <span>{t("dataQuality.table.source")}</span>
              <span>{t("dataQuality.table.asset")}</span>
              <span>{t("dataQuality.table.status")}</span>
            </div>
            {state.records.slice(0, 25).map((record) => (
              <div className="rejected-records-row" key={record.id}>
                <span>{formatDateTime(record.received_at, noData, locale)}</span>
                <span>
                  <strong>{translateRejectionReason(record.reason, t, noData)}</strong>
                  <small>{t("dataQuality.table.rawReasonCode", { code: record.reason })}</small>
                </span>
                <span>
                  <strong>{translateTelemetrySource(record.source, t, noData)}</strong>
                  <small>{record.topic || noData}</small>
                </span>
                <span>{getPlantName(plants, record.plant_id, noData)}</span>
                <span>
                  <StatusBadge status={record.resolution_status} t={t} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            detail={t("dataQuality.empty.noRecordsDetail")}
            title={t("dataQuality.empty.noRecordsTitle")}
          />
        )}
      </Panel>
    </section>
  );
}

function MonitoringStatusBadge({ status, t }: { status: MonitoringStatus; t: Translate }) {
  return (
    <span className={`monitoring-badge ${status}`}>
      {translateMonitoringCompactStatus(status, t)}
    </span>
  );
}

function SystemHealthSection({
  health,
  system,
  latest,
  summary,
  forecastRuns,
  loading,
  locale,
  t,
}: {
  health: HealthResponse | null;
  system: SystemStatusResponse | null;
  latest: TelemetryPoint | null;
  summary: TelemetrySummary | null;
  forecastRuns: ForecastRun[];
  loading: boolean;
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const notAvailable = t("systemHealth.notAvailable");
  const dependencies = system?.dependencies || {};
  const apiStatus = getMonitoringStatus(system?.status || health?.status);
  const databaseStatus = getMonitoringStatus(dependencies.postgres?.status);
  const redisStatus = getMonitoringStatus(dependencies.redis?.status);
  const qdrantStatus = getMonitoringStatus(dependencies.qdrant?.status);
  const mqttStatus: MonitoringStatus = "unknown";
  const dataFreshnessStatus = getFreshnessMonitoringStatus(summary?.data_freshness_status);
  const platformStatus = getPlatformStatus([
    apiStatus,
    databaseStatus,
    redisStatus,
    qdrantStatus,
    dataFreshnessStatus,
  ]);
  const monitoredStatuses = [
    apiStatus,
    databaseStatus,
    redisStatus,
    qdrantStatus,
    mqttStatus,
    dataFreshnessStatus,
  ];
  const healthyCount = monitoredStatuses.filter((status) => status === "healthy").length;
  const warningCount = monitoredStatuses.filter((status) => status === "warning").length;
  const criticalCount = monitoredStatuses.filter((status) => status === "critical").length;
  const unknownCount = monitoredStatuses.filter((status) => status === "unknown").length;
  const lastTelemetryUpdate = summary?.last_telemetry_time ?? latest?.timestamp ?? null;
  const lastForecastUpdate = getLatestForecastUpdate(forecastRuns);
  const serviceRows = [
    {
      key: "api",
      label: t("systemHealth.services.api"),
      detail: health?.service || system?.service || notAvailable,
      status: apiStatus,
      latency: null,
    },
    {
      key: "database",
      label: t("systemHealth.services.database"),
      detail: dependencies.postgres?.message || t("system.dependencyOk"),
      status: databaseStatus,
      latency: dependencies.postgres?.latency_ms,
    },
    {
      key: "redis",
      label: t("systemHealth.services.redis"),
      detail: dependencies.redis?.message || t("system.dependencyOk"),
      status: redisStatus,
      latency: dependencies.redis?.latency_ms,
    },
    {
      key: "qdrant",
      label: t("systemHealth.services.qdrant"),
      detail: dependencies.qdrant?.message || t("system.dependencyOk"),
      status: qdrantStatus,
      latency: dependencies.qdrant?.latency_ms,
    },
    {
      key: "mqtt",
      label: t("systemHealth.services.mqtt"),
      detail: t("systemHealth.mqttUnavailable"),
      status: mqttStatus,
      latency: null,
    },
  ];

  return (
    <section className="section-stack">
      {!loading && !health && !system ? (
        <EmptyState
          detail={t("systemHealth.empty.unavailableDetail")}
          title={t("systemHealth.empty.unavailableTitle")}
        />
      ) : null}

      <section className="metric-grid system-health-metric-grid">
        <MetricCard
          helper={t("systemHealth.kpi.overallHelper")}
          label={t("systemHealth.kpi.overall")}
          loading={loading}
          t={t}
          value={translateMonitoringCompactStatus(platformStatus, t)}
        />
        <MetricCard
          helper={health?.service || system?.service || notAvailable}
          label={t("systemHealth.kpi.api")}
          loading={loading}
          t={t}
          value={translateMonitoringCompactStatus(apiStatus, t)}
        />
        <MetricCard
          helper={t("systemHealth.kpi.databaseHelper")}
          label={t("systemHealth.kpi.database")}
          loading={loading}
          t={t}
          value={translateMonitoringCompactStatus(databaseStatus, t)}
        />
        <MetricCard
          helper={t("systemHealth.kpi.redisHelper")}
          label={t("systemHealth.kpi.redis")}
          loading={loading}
          t={t}
          value={translateMonitoringCompactStatus(redisStatus, t)}
        />
        <MetricCard
          helper={t("systemHealth.kpi.qdrantHelper")}
          label={t("systemHealth.kpi.qdrant")}
          loading={loading}
          t={t}
          value={translateMonitoringCompactStatus(qdrantStatus, t)}
        />
        <MetricCard
          helper={t("systemHealth.kpi.mqttHelper")}
          label={t("systemHealth.kpi.mqtt")}
          loading={loading}
          t={t}
          value={translateMonitoringCompactStatus(mqttStatus, t)}
        />
        <MetricCard
          helper={t("systemHealth.kpi.freshnessHelper")}
          label={t("systemHealth.kpi.dataFreshness")}
          loading={loading}
          t={t}
          value={translateFreshnessCompactStatus(summary?.data_freshness_status, t, notAvailable)}
        />
        <MetricCard
          helper={t("systemHealth.kpi.telemetryHelper")}
          label={t("systemHealth.kpi.lastTelemetry")}
          loading={loading}
          t={t}
          value={formatDateTime(lastTelemetryUpdate, noData, locale)}
        />
      </section>

      <section className="system-health-layout">
        <Panel eyebrow={t("systemHealth.summary.eyebrow")} title={t("systemHealth.summary.title")}>
          {loading ? (
            <EmptyState
              detail={t("systemHealth.loading.summaryDetail")}
              title={t("systemHealth.loading.summaryTitle")}
            />
          ) : (
            <div className="platform-status-card">
              <MonitoringStatusBadge status={platformStatus} t={t} />
              <strong>{t(`systemHealth.statusDetail.${platformStatus}`)}</strong>
              <div className="platform-status-grid">
                <div>
                  <span>{t("systemHealth.summary.healthy")}</span>
                  <strong>{formatNumber(healthyCount, 0, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("systemHealth.summary.warning")}</span>
                  <strong>{formatNumber(warningCount, 0, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("systemHealth.summary.critical")}</span>
                  <strong>{formatNumber(criticalCount, 0, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("systemHealth.summary.unknown")}</span>
                  <strong>{formatNumber(unknownCount, 0, noData, locale)}</strong>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel eyebrow={t("systemHealth.signals.eyebrow")} title={t("systemHealth.signals.title")}>
          {loading ? (
            <EmptyState
              detail={t("systemHealth.loading.signalsDetail")}
              title={t("systemHealth.loading.signalsTitle")}
            />
          ) : (
            <div className="system-signal-list">
              <div>
                <span>{t("systemHealth.signals.lastTelemetry")}</span>
                <strong>{formatDateTime(lastTelemetryUpdate, noData, locale)}</strong>
              </div>
              <div>
                <span>{t("systemHealth.signals.dataFreshness")}</span>
                <strong>
                  {summary?.data_freshness_status
                    ? t(`telemetry.freshness.${summary.data_freshness_status}`)
                    : notAvailable}
                </strong>
              </div>
              <div>
                <span>{t("systemHealth.signals.lastForecast")}</span>
                <strong>{formatDateTime(lastForecastUpdate, noData, locale)}</strong>
              </div>
              <div>
                <span>{t("systemHealth.signals.environment")}</span>
                <strong>{translateEnvironment(system?.environment || health?.environment, t, notAvailable)}</strong>
              </div>
              <div>
                <span>{t("systemHealth.signals.version")}</span>
                <strong>{system?.version || health?.version || notAvailable}</strong>
              </div>
            </div>
          )}
        </Panel>
      </section>

      <Panel eyebrow={t("systemHealth.services.eyebrow")} title={t("systemHealth.services.title")}>
        {loading ? (
          <EmptyState
            detail={t("systemHealth.loading.servicesDetail")}
            title={t("systemHealth.loading.servicesTitle")}
          />
        ) : (
          <div className="service-health-table">
            <div className="service-health-head">
              <span>{t("systemHealth.services.service")}</span>
              <span>{t("systemHealth.services.status")}</span>
              <span>{t("systemHealth.services.latency")}</span>
              <span>{t("systemHealth.services.detail")}</span>
            </div>
            {serviceRows.map((row) => (
              <div className="service-health-row" key={row.key}>
                <strong>{row.label}</strong>
                <span>
                  <MonitoringStatusBadge status={row.status} t={t} />
                </span>
                <span>
                  {row.latency === null || row.latency === undefined
                    ? notAvailable
                    : t("common.milliseconds", {
                        value: formatNumber(row.latency, 0, noData, locale),
                      })}
                </span>
                <span>{row.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

function FreshnessBadge({ status, t }: { status?: TelemetrySummary["data_freshness_status"]; t: Translate }) {
  const normalized = status || "no_data";
  return (
    <span className={`freshness-badge ${normalized}`}>
      {translateFreshnessCompactStatus(normalized, t, t("common.noData"))}
    </span>
  );
}

function PowerHistoryChart({
  points,
  locale,
  t,
}: {
  points: TelemetryPoint[];
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  if (points.length === 0) {
    return (
      <EmptyState
        detail={t("telemetry.history.emptyDetail")}
        title={t("telemetry.history.emptyTitle")}
      />
    );
  }

  const width = 720;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.actual_power_kw);
  const maxValue = Math.max(...values, 1);
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coordinates = points.map((point, index) => {
    const x = padding + index * xStep;
    const y = height - padding - (point.actual_power_kw / maxValue) * (height - padding * 2);
    return { x, y, point };
  });
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <div className="power-chart">
      <div className="chart-meta">
        <span>
          {t("telemetry.history.points", {
            count: formatNumber(points.length, 0, noData, locale),
          })}
        </span>
        <span>
          {t("telemetry.history.maxPower", {
            value: formatNumber(maxValue, 1, noData, locale),
          })}
        </span>
      </div>
      <svg aria-label={t("telemetry.history.title")} viewBox={`0 0 ${width} ${height}`}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <polyline points={polyline} />
        {coordinates.map(({ x, y, point }) => (
          <circle key={point.id} cx={x} cy={y} r="4" />
        ))}
      </svg>
      <div className="chart-range">
        <span>{formatDateTime(firstPoint?.timestamp, noData, locale)}</span>
        <span>{formatDateTime(lastPoint?.timestamp, noData, locale)}</span>
      </div>
    </div>
  );
}

function TelemetrySection({
  plants,
  latest,
  history,
  summary,
  assetId,
  loading,
  locale,
  t,
}: {
  plants: SolarPlant[];
  latest: TelemetryPoint | null;
  history: TelemetryPoint[];
  summary: TelemetrySummary | null;
  assetId: string | null;
  loading: boolean;
  locale: Locale;
  t: Translate;
}) {
  const noData = t("common.noData");
  const selectedPlant = plants.find((plant) => plant.id === assetId);
  const freshnessStatus = summary?.data_freshness_status || "no_data";

  return (
    <section className="section-stack">
      {!loading && !assetId ? (
        <EmptyState
          detail={t("telemetry.empty.noAssetDetail")}
          title={t("telemetry.empty.noAssetTitle")}
        />
      ) : null}

      {!loading && assetId && !summary ? (
        <EmptyState
          detail={t("telemetry.empty.unavailableDetail")}
          title={t("telemetry.empty.unavailableTitle")}
        />
      ) : null}

      <section className="metric-grid telemetry-metric-grid">
        <MetricCard
          helper={selectedPlant?.name || noData}
          label={t("telemetry.kpi.currentPower")}
          loading={loading}
          t={t}
          value={formatTranslatedUnit(
            summary?.current_power_kw ?? latest?.actual_power_kw,
            "telemetry.units.kw",
            t,
            noData,
            1,
            locale,
          )}
        />
        <MetricCard
          helper={t("telemetry.kpi.energyTodayHelper")}
          label={t("telemetry.kpi.energyToday")}
          loading={loading}
          t={t}
          value={formatTranslatedUnit(summary?.energy_today_kwh, "telemetry.units.kwh", t, noData, 1, locale)}
        />
        <MetricCard
          helper={t("telemetry.kpi.averagePowerHelper")}
          label={t("telemetry.kpi.averagePower")}
          loading={loading}
          t={t}
          value={formatTranslatedUnit(summary?.avg_power_kw, "telemetry.units.kw", t, noData, 1, locale)}
        />
        <MetricCard
          helper={t("telemetry.kpi.maxPowerHelper")}
          label={t("telemetry.kpi.maxPower")}
          loading={loading}
          t={t}
          value={formatTranslatedUnit(summary?.max_power_kw, "telemetry.units.kw", t, noData, 1, locale)}
        />
        <MetricCard
          helper={t("telemetry.kpi.lastTelemetryHelper")}
          label={t("telemetry.kpi.lastTelemetry")}
          loading={loading}
          t={t}
          value={formatDateTime(summary?.last_telemetry_time ?? latest?.timestamp, noData, locale)}
        />
        <MetricCard
          helper={t("telemetry.kpi.freshnessHelper")}
          label={t("telemetry.kpi.freshness")}
          loading={loading}
          t={t}
          value={t(`telemetry.freshness.${freshnessStatus}`)}
        />
        <MetricCard
          helper={t("telemetry.kpi.pointsHelper")}
          label={t("telemetry.kpi.points")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.telemetry_points_count, 0, noData, locale)}
        />
        <MetricCard
          helper={t("telemetry.kpi.gapHelper")}
          label={t("telemetry.kpi.gap")}
          loading={loading}
          t={t}
          value={formatTranslatedUnit(
            summary?.possible_data_gap_minutes,
            "telemetry.units.minutes",
            t,
            noData,
            0,
            locale,
          )}
        />
        {summary?.estimated_revenue_today !== null && summary?.estimated_revenue_today !== undefined ? (
          <MetricCard
            helper={t("telemetry.kpi.revenueHelper")}
            label={t("telemetry.kpi.revenue")}
            loading={loading}
            t={t}
            value={formatNumber(summary.estimated_revenue_today, 2, noData, locale)}
          />
        ) : null}
      </section>

      <section className="telemetry-layout">
        <Panel eyebrow={t("telemetry.history.eyebrow")} title={t("telemetry.history.title")}>
          {loading ? (
            <EmptyState
              detail={t("telemetry.history.loadingDetail")}
              title={t("telemetry.history.loadingTitle")}
            />
          ) : (
            <PowerHistoryChart locale={locale} points={history} t={t} />
          )}
        </Panel>

        <Panel eyebrow={t("telemetry.status.eyebrow")} title={t("telemetry.status.title")}>
          {loading ? (
            <EmptyState
              detail={t("telemetry.status.loadingDetail")}
              title={t("telemetry.status.loadingTitle")}
            />
          ) : (
            <div className="telemetry-status-card">
              <FreshnessBadge status={summary?.data_freshness_status} t={t} />
              <div>
                <span>{t("telemetry.status.asset")}</span>
                <strong>{selectedPlant?.name || noData}</strong>
              </div>
              <div>
                <span>{t("telemetry.status.source")}</span>
                <strong>{translateTelemetrySource(latest?.source, t, noData)}</strong>
              </div>
              <div>
                <span>{t("telemetry.status.quality")}</span>
                <strong>{translateTelemetryQuality(latest?.quality, t, noData)}</strong>
              </div>
              <div>
                <span>{t("telemetry.status.lastTelemetry")}</span>
                <strong>{formatDateTime(summary?.last_telemetry_time ?? latest?.timestamp, noData, locale)}</strong>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </section>
  );
}

function DashboardOverview({
  locale,
  onLocaleChange,
  t,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  t: Translate;
}) {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    data: emptyData,
  });
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [selectedProfilePlantId, setSelectedProfilePlantId] = useState("");
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);

  const openPlantProfile = (plantId: string) => {
    setSelectedProfilePlantId(plantId);
    setActiveSection("solar-plant-profile");
  };

  const addCreatedPlant = (plant: SolarPlant) => {
    setState((current) => ({
      ...current,
      data: {
        ...current.data,
        plants: [plant, ...current.data.plants.filter((item) => item.id !== plant.id)],
      },
    }));
  };

  const period = useMemo(() => {
    const periodTo = new Date();
    const periodFrom = new Date(periodTo);
    periodFrom.setDate(periodFrom.getDate() - 7);

    return {
      from: periodFrom.toISOString(),
      to: periodTo.toISOString(),
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const [health, system, plants, providers, forecastRuns, accuracy, accuracyRanking, rejected, alertsSummary] =
        await Promise.allSettled([
        fetchJson<HealthResponse>("/health"),
        fetchJson<SystemStatusResponse>("/api/v1/system/status"),
        fetchJson<SolarPlant[]>("/api/v1/solar-plants"),
        fetchJson<ForecastProvider[]>("/api/v1/forecast-providers"),
        fetchJson<ForecastRun[]>("/api/v1/forecast-runs"),
        fetchJson<AccuracySummary>("/api/v1/accuracy-lab/summary", {
          from: period.from,
          to: period.to,
          bucket: "day",
        }),
        fetchJson<AccuracyProviderRankingResponse>("/api/v1/accuracy-lab/providers/ranking", {
          from: period.from,
          to: period.to,
          bucket: "day",
        }),
        fetchJson<RejectedTelemetrySummary>("/api/v1/telemetry/rejected/summary", {
          from: period.from,
          to: period.to,
          resolution_status: "open",
        }),
        fetchJson<AlertsSummaryResponse>("/api/v1/alerts/summary", {
          from: period.from,
          to: period.to,
        }),
      ]);

      if (!mounted) {
        return;
      }

      const plantList = plants.status === "fulfilled" ? plants.value : [];
      const telemetryAssetId = plantList[0]?.id || null;
      const [telemetryLatest, telemetryHistory, telemetrySummary] = telemetryAssetId
        ? await Promise.allSettled([
            fetchJson<TelemetryPoint>("/api/v1/telemetry/latest", {
              asset_id: telemetryAssetId,
            }),
            fetchJson<TelemetryPoint[]>("/api/v1/telemetry/history", {
              asset_id: telemetryAssetId,
              from: period.from,
              to: period.to,
              limit: "96",
            }),
            fetchJson<TelemetrySummary>("/api/v1/telemetry/summary", {
              asset_id: telemetryAssetId,
              from: period.from,
              to: period.to,
            }),
          ])
        : [];

      const nextData: DashboardData = {
        health: health.status === "fulfilled" ? health.value : null,
        system: system.status === "fulfilled" ? system.value : null,
        plants: plantList,
        providers: providers.status === "fulfilled" ? providers.value : [],
        forecastRuns: forecastRuns.status === "fulfilled" ? forecastRuns.value : [],
        accuracy: accuracy.status === "fulfilled" ? accuracy.value : null,
        accuracyRanking: accuracyRanking.status === "fulfilled" ? accuracyRanking.value : null,
        rejected: rejected.status === "fulfilled" ? rejected.value : null,
        telemetryLatest: telemetryLatest?.status === "fulfilled" ? telemetryLatest.value : null,
        telemetryHistory: telemetryHistory?.status === "fulfilled" ? telemetryHistory.value : [],
        telemetrySummary: telemetrySummary?.status === "fulfilled" ? telemetrySummary.value : null,
        telemetryAssetId,
        alertsSummary: alertsSummary.status === "fulfilled" ? alertsSummary.value : null,
      };

      const hasAnyData =
        Boolean(nextData.health) ||
        Boolean(nextData.system) ||
        nextData.plants.length > 0 ||
        nextData.providers.length > 0 ||
        nextData.forecastRuns.length > 0 ||
        Boolean(nextData.accuracy) ||
        Boolean(nextData.accuracyRanking) ||
        Boolean(nextData.rejected) ||
        Boolean(nextData.alertsSummary) ||
        Boolean(nextData.telemetrySummary) ||
        nextData.telemetryHistory.length > 0;

      setState({
        loading: false,
        error: hasAnyData ? null : "apiUnavailable",
        data: nextData,
      });
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [period.from, period.to, dashboardRefreshToken]);

  const totalCapacity = state.data.plants.reduce(
    (sum, plant) => sum + plant.capacity_kw,
    0,
  );
  const activeProviders = state.data.providers.filter(
    (provider) => normalizeMachineValue(provider.status || (provider.is_active ? "active" : "inactive")) === "active",
  ).length;
  const systemStatus = state.data.system?.status || state.data.health?.status;
  const dependencies = Object.entries(state.data.system?.dependencies || {});
  const topRejectedReasons = state.data.rejected?.items.slice(0, 4) || [];
  const noData = t("common.noData");
  const activeNavigationItem =
    navigationItems.find((item) => item.key === activeSection) || navigationItems[0];
  const activeSectionTitle = t(`navigation.${activeNavigationItem.labelKey}`);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">{t("brand.mark")}</span>
          <div>
            <strong>{t("brand.name")}</strong>
            <small>{t("brand.subtitle")}</small>
          </div>
        </div>

        <nav className="nav">
          {navigationItems.map((item) => (
            <button
              aria-current={activeSection === item.key ? "page" : undefined}
              className={activeSection === item.key ? "active" : ""}
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              type="button"
            >
              {t(`navigation.${item.labelKey}`)}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="top-header">
          <div>
            <p className="eyebrow">{t("header.eyebrow")}</p>
            <h1>{activeSectionTitle}</h1>
          </div>
          <div className="header-actions">
            <div className="language-switcher" aria-label={t("header.languageLabel")}>
              {locales.map((item) => (
                <button
                  className={locale === item ? "active" : ""}
                  key={item}
                  onClick={() => onLocaleChange(item)}
                  type="button"
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <span>{t("header.period")}</span>
            <StatusBadge status={systemStatus} t={t} />
          </div>
        </header>

        {activeSection === "overview" ? (
          <>
            {state.error ? (
              <EmptyState
                detail={t("errors.apiUnavailableDetail")}
                title={t("errors.apiUnavailableTitle")}
              />
            ) : null}

            <section className="metric-grid">
              <MetricCard
                helper={t("common.dependenciesChecked", { count: dependencies.length })}
                label={t("metrics.systemHealth")}
                loading={state.loading}
                t={t}
                value={translateMonitoringStatusValue(systemStatus, t, noData)}
              />
              <MetricCard
                helper={t("metrics.totalCapacity", {
                  value: formatNumber(totalCapacity, 0, noData, locale),
                })}
                label={t("metrics.solarPlants")}
                loading={state.loading}
                t={t}
                value={formatNumber(state.data.plants.length, 0, noData, locale)}
              />
              <MetricCard
                helper={t("common.activeProviders", { count: activeProviders })}
                label={t("metrics.forecastProviders")}
                loading={state.loading}
                t={t}
                value={formatNumber(state.data.providers.length, 0, noData, locale)}
              />
              <MetricCard
                helper={t("common.samples", {
                  count: formatNumber(state.data.accuracy?.samples_count, 0, noData, locale),
                })}
                label={t("metrics.accuracyMape")}
                loading={state.loading}
                t={t}
                value={formatPercent(state.data.accuracy?.avg_mape, noData, locale)}
              />
              <MetricCard
                helper={t("metrics.openTelemetryIssues")}
                label={t("metrics.rejectedTelemetry")}
                loading={state.loading}
                t={t}
                value={formatNumber(state.data.rejected?.total, 0, noData, locale)}
              />
            </section>

            <section className="panel-grid">
              <Panel eyebrow={t("panels.runtime")} title={t("panels.systemHealth")}>
            {state.loading ? (
              <EmptyState detail={t("system.loadingDetail")} title={t("system.loadingTitle")} />
            ) : dependencies.length > 0 ? (
              <div className="dependency-list">
                {dependencies.map(([name, dependency]) => (
                  <div className="dependency-row" key={name}>
                    <div>
                      <strong>{name}</strong>
                      <span>{dependency.message || t("system.dependencyOk")}</span>
                    </div>
                    <div className="dependency-meta">
                      <small>
                        {t("common.milliseconds", {
                          value: formatNumber(dependency.latency_ms, 0, noData, locale),
                        })}
                      </small>
                      <StatusBadge status={dependency.status} t={t} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState detail={t("system.emptyDetail")} title={t("system.emptyTitle")} />
            )}
              </Panel>

              <Panel eyebrow={t("panels.assets")} title={t("panels.solarPlants")}>
            {state.loading ? (
              <EmptyState detail={t("solarPlants.loadingDetail")} title={t("solarPlants.loadingTitle")} />
            ) : state.data.plants.length > 0 ? (
              <div className="table">
                {state.data.plants.slice(0, 5).map((plant) => (
                  <div className="table-row" key={plant.id}>
                    <div>
                      <strong>{plant.name}</strong>
                      <span>
                        {t("common.kilowatts", {
                          value: formatNumber(plant.capacity_kw, 0, noData, locale),
                        })}
                      </span>
                    </div>
                    <StatusBadge status={plant.status} t={t} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState detail={t("solarPlants.emptyDetail")} title={t("solarPlants.emptyTitle")} />
            )}
              </Panel>

              <Panel eyebrow={t("panels.forecast")} title={t("panels.accuracySummary")}>
            {state.loading ? (
              <EmptyState detail={t("accuracy.loadingDetail")} title={t("accuracy.loadingTitle")} />
            ) : state.data.accuracy ? (
              <div className="accuracy-grid">
                <div>
                  <span>{t("accuracy.avgMape")}</span>
                  <strong>{formatPercent(state.data.accuracy.avg_mape, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.avgRmse")}</span>
                  <strong>{formatNumber(state.data.accuracy.avg_rmse, 2, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.avgMae")}</span>
                  <strong>{formatNumber(state.data.accuracy.avg_mae, 2, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.avgBias")}</span>
                  <strong>{formatNumber(state.data.accuracy.avg_bias, 2, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.forecastRuns")}</span>
                  <strong>{formatNumber(state.data.accuracy.forecast_runs_count, 0, noData, locale)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.aggregates")}</span>
                  <strong>{formatNumber(state.data.accuracy.aggregates_count, 0, noData, locale)}</strong>
                </div>
              </div>
            ) : (
              <EmptyState detail={t("accuracy.emptyDetail")} title={t("accuracy.emptyTitle")} />
            )}
              </Panel>

              <Panel eyebrow={t("panels.providers")} title={t("panels.forecastProviders")}>
            {state.loading ? (
              <EmptyState detail={t("providers.loadingDetail")} title={t("providers.loadingTitle")} />
            ) : state.data.providers.length > 0 ? (
              <div className="table">
                {state.data.providers.map((provider) => (
                  <div className="table-row" key={provider.id}>
                    <div>
                      <strong>{translateProviderName(provider.name, provider.code, t, noData)}</strong>
                      <span>
                        {translateProviderType(provider.provider_type, t, noData)} /{" "}
                        {translateProviderDataStatus(provider.data_status, t, noData)}
                      </span>
                    </div>
                    <StatusBadge status={provider.status} t={t} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState detail={t("providers.emptyDetail")} title={t("providers.emptyTitle")} />
            )}
              </Panel>

              <Panel eyebrow={t("panels.quality")} title={t("panels.rejectedTelemetrySummary")}>
            {state.loading ? (
              <EmptyState
                detail={t("rejectedTelemetry.loadingDetail")}
                title={t("rejectedTelemetry.loadingTitle")}
              />
            ) : state.data.rejected ? (
              <div className="rejected-summary">
                <div className="rejected-total">
                  <strong>{formatNumber(state.data.rejected.total, 0, noData, locale)}</strong>
                  <span>{t("rejectedTelemetry.openMessages")}</span>
                </div>
                {topRejectedReasons.length > 0 ? (
                  <div className="reason-list">
                    {topRejectedReasons.map((item) => (
                      <div className="reason-row" key={item.reason}>
                        <span>{translateRejectionReason(item.reason, t, noData)}</span>
                        <strong>{formatNumber(item.count, 0, noData, locale)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    detail={t("rejectedTelemetry.cleanDetail")}
                    title={t("rejectedTelemetry.cleanTitle")}
                  />
                )}
              </div>
            ) : (
              <EmptyState
                detail={t("rejectedTelemetry.emptyDetail")}
                title={t("rejectedTelemetry.emptyTitle")}
              />
            )}
              </Panel>
            </section>
          </>
        ) : activeSection === "solar-plants" ? (
          <SolarPlantsSection
            locale={locale}
            plants={state.data.plants}
            loading={state.loading}
            onPlantCreated={addCreatedPlant}
            onSelectPlant={openPlantProfile}
            t={t}
          />
        ) : activeSection === "solar-plant-profile" ? (
          <SolarPlantProfileSection
            forecastRuns={state.data.forecastRuns}
            loading={state.loading}
            locale={locale}
            onSelectedPlantIdChange={setSelectedProfilePlantId}
            period={period}
            plants={state.data.plants}
            selectedPlantId={selectedProfilePlantId}
            system={state.data.system}
            t={t}
          />
        ) : activeSection === "forecast-insights" ? (
          <ForecastInsightsSection
            forecastRuns={state.data.forecastRuns}
            locale={locale}
            loading={state.loading}
            plants={state.data.plants}
            ranking={state.data.accuracyRanking}
            summary={state.data.accuracy}
            telemetrySummary={state.data.telemetrySummary}
            t={t}
          />
        ) : activeSection === "alerts-center" ? (
          <AlertsCenterSection
            data={state.data}
            locale={locale}
            loading={state.loading}
            t={t}
          />
        ) : activeSection === "forecast-accuracy-lab" ? (
          <ForecastAccuracyLabSection
            locale={locale}
            loading={state.loading}
            onImportComplete={() => setDashboardRefreshToken((current) => current + 1)}
            plants={state.data.plants}
            ranking={state.data.accuracyRanking}
            summary={state.data.accuracy}
            t={t}
          />
        ) : activeSection === "forecast-providers" ? (
          <ForecastProvidersSection
            locale={locale}
            loading={state.loading}
            providers={state.data.providers}
            t={t}
          />
        ) : activeSection === "telemetry" ? (
          <TelemetrySection
            assetId={state.data.telemetryAssetId}
            history={state.data.telemetryHistory}
            latest={state.data.telemetryLatest}
            locale={locale}
            loading={state.loading}
            plants={state.data.plants}
            summary={state.data.telemetrySummary}
            t={t}
          />
        ) : activeSection === "rejected-telemetry" ? (
          <DataQualitySection locale={locale} plants={state.data.plants} t={t} />
        ) : activeSection === "system-status" ? (
          <SystemHealthSection
            forecastRuns={state.data.forecastRuns}
            health={state.data.health}
            latest={state.data.telemetryLatest}
            locale={locale}
            loading={state.loading}
            summary={state.data.telemetrySummary}
            system={state.data.system}
            t={t}
          />
        ) : (
          <SectionPlaceholder title={activeSectionTitle} t={t} />
        )}
      </section>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #09090b;
          color: #f5f2ed;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .dashboard-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          background:
            radial-gradient(circle at top left, rgba(255, 122, 24, 0.12), transparent 34rem),
            #09090b;
        }

        .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(12, 12, 15, 0.88);
          padding: 24px 18px;
          backdrop-filter: blur(18px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 8px 28px;
        }

        .brand-mark {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 1px solid rgba(255, 122, 24, 0.54);
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(255, 122, 24, 0.24), rgba(255, 122, 24, 0.06));
          color: #ff8a2a;
          font-size: 13px;
          font-weight: 800;
        }

        .brand strong,
        .brand small {
          display: block;
        }

        .brand strong {
          font-size: 15px;
          letter-spacing: -0.01em;
        }

        .brand small {
          margin-top: 3px;
          color: rgba(245, 242, 237, 0.52);
          font-size: 12px;
        }

        .nav {
          display: grid;
          gap: 6px;
        }

        .nav button {
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          color: rgba(245, 242, 237, 0.68);
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          padding: 11px 12px;
          text-align: left;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease;
        }

        .nav button:hover,
        .nav button.active {
          border-color: rgba(255, 122, 24, 0.22);
          background: rgba(255, 122, 24, 0.1);
          color: #fff7ed;
        }

        .nav button:focus-visible,
        .language-switcher button:focus-visible {
          outline: 2px solid rgba(255, 122, 24, 0.74);
          outline-offset: 2px;
        }

        .workspace {
          min-width: 0;
          padding: 28px;
        }

        .top-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .language-switcher {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          padding: 4px;
        }

        .language-switcher button {
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(245, 242, 237, 0.58);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          padding: 6px 9px;
        }

        .language-switcher button.active {
          background: rgba(255, 122, 24, 0.18);
          color: #ffad66;
        }

        .header-actions > span {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: rgba(245, 242, 237, 0.68);
          font-size: 13px;
          padding: 8px 12px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #ff7a18;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: clamp(32px, 4vw, 48px);
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .section-stack {
          display: grid;
          gap: 18px;
        }

        .solar-metric-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .accuracy-lab-metric-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .providers-metric-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .forecast-insights-metric-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .alerts-metric-grid {
          grid-template-columns: repeat(7, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .telemetry-metric-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .data-quality-metric-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .metric-card,
        .panel,
        .empty-state {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028));
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
        }

        .metric-card {
          min-width: 0;
          min-height: 136px;
          border-radius: 18px;
          padding: 18px;
        }

        .metric-card p,
        .metric-card span {
          margin: 0;
          color: rgba(245, 242, 237, 0.56);
          font-size: 13px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .metric-card strong,
        .metric-value {
          display: block;
          margin: 18px 0 10px;
          color: #fffaf4;
          font-size: clamp(23px, 2.6vw, 32px);
          letter-spacing: -0.045em;
          line-height: 1.08;
          max-width: 100%;
          overflow-wrap: break-word;
          white-space: normal;
          word-break: normal;
        }

        .metric-card strong.metric-value-text,
        .metric-value.metric-value-text {
          font-size: clamp(16px, 1.35vw, 21px);
          letter-spacing: -0.025em;
          line-height: 1.16;
          max-width: 100%;
          overflow-wrap: break-word;
          white-space: normal;
          word-break: normal;
        }

        .panel-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .panel {
          border-radius: 22px;
          padding: 20px;
        }

        .solar-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
          gap: 18px;
          align-items: start;
        }

        .plant-profile-layout {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }

        .accuracy-lab-layout {
          display: grid;
          grid-template-columns: minmax(360px, 0.72fr) minmax(0, 1.28fr);
          gap: 18px;
          align-items: start;
        }

        .providers-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
          gap: 18px;
          align-items: start;
        }

        .forecast-insights-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
          gap: 18px;
          align-items: start;
        }

        .alerts-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 0.72fr);
          gap: 18px;
          align-items: start;
        }

        .telemetry-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
          gap: 18px;
          align-items: start;
        }

        .target-card {
          display: grid;
          gap: 14px;
        }

        .target-status {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.2);
          padding: 18px;
        }

        .target-status.excellent {
          border-color: rgba(50, 213, 131, 0.34);
          background: rgba(50, 213, 131, 0.1);
        }

        .target-status.onTarget {
          border-color: rgba(255, 122, 24, 0.34);
          background: rgba(255, 122, 24, 0.1);
        }

        .target-status.aboveTarget {
          border-color: rgba(255, 183, 77, 0.34);
          background: rgba(255, 183, 77, 0.1);
        }

        .target-status.noData {
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
        }

        .target-status span,
        .target-grid span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 700;
        }

        .target-status strong {
          display: block;
          margin-top: 10px;
          color: #fffaf4;
          font-size: 44px;
          letter-spacing: -0.06em;
          line-height: 1;
        }

        .target-status em {
          display: inline-flex;
          margin-top: 12px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.22);
          color: #fffaf4;
          font-size: 12px;
          font-style: normal;
          font-weight: 800;
          padding: 7px 10px;
          text-transform: uppercase;
        }

        .target-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .target-grid div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .target-grid strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .ranking-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .ranking-table-head,
        .ranking-table-row {
          display: grid;
          grid-template-columns: 72px minmax(170px, 1.4fr) repeat(6, minmax(96px, 0.8fr));
          gap: 12px;
          min-width: 960px;
          align-items: center;
        }

        .ranking-table-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .ranking-table-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .ranking-table-row > strong,
        .ranking-table-row span strong {
          color: #fffaf4;
          font-size: 14px;
        }

        .ranking-table-row span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 13px;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .ranking-table-row small {
          display: block;
          margin-top: 4px;
          color: rgba(245, 242, 237, 0.44);
          font-size: 12px;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .providers-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .providers-table-head,
        .providers-table-row {
          display: grid;
          grid-template-columns: minmax(170px, 1.3fr) repeat(7, minmax(100px, 0.8fr));
          gap: 12px;
          min-width: 980px;
          align-items: center;
        }

        .providers-table-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .providers-table-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .providers-table-row strong {
          color: #fffaf4;
          font-size: 14px;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .providers-table-row span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 13px;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .provider-comparison-card {
          display: grid;
          gap: 12px;
        }

        .provider-comparison-card div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.18);
          padding: 16px;
        }

        .provider-comparison-card .provider-delta {
          border-color: rgba(255, 122, 24, 0.28);
          background: radial-gradient(circle at top left, rgba(255, 122, 24, 0.14), rgba(0, 0, 0, 0.18));
        }

        .provider-comparison-card span,
        .provider-comparison-card small {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 700;
        }

        .provider-comparison-card strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 20px;
          letter-spacing: -0.04em;
          line-height: 1.15;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .provider-comparison-card small {
          margin-top: 8px;
          color: #ffad66;
        }

        .provider-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .provider-card {
          display: grid;
          gap: 14px;
          align-content: start;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.18);
          min-width: 0;
          overflow: visible;
          padding: 16px;
        }

        .provider-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .provider-card-header > div {
          min-width: 0;
        }

        .provider-card-header span,
        .provider-card-metrics dt {
          color: rgba(245, 242, 237, 0.52);
          font-size: 12px;
          font-weight: 800;
        }

        .provider-card-header strong {
          display: block;
          margin-top: 6px;
          color: #fffaf4;
          font-size: 18px;
          line-height: 1.15;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .provider-card-badges {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .provider-card-badges .status-badge,
        .provider-card-header .status-badge {
          flex: 0 0 auto;
          font-size: 10px;
          line-height: 1.15;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 6px 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
          word-break: normal;
        }

        .provider-card-header .provider-badge {
          max-width: 45%;
        }

        .provider-card-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0;
        }

        .provider-card-metrics div {
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 10px;
        }

        .provider-card-metrics dd {
          margin: 4px 0 0;
          color: #fffaf4;
          font-size: 14px;
          font-weight: 800;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .provider-card p {
          margin: 0;
          color: rgba(245, 242, 237, 0.68);
          font-size: 13px;
          line-height: 1.5;
          min-width: 0;
          overflow-wrap: break-word;
          padding-bottom: 2px;
          word-break: normal;
        }

        .forecast-thresholds {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .forecast-thresholds div,
        .forecast-insights-summary div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .forecast-thresholds span,
        .forecast-insights-summary span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .forecast-thresholds strong,
        .forecast-insights-summary strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 15px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .forecast-insights-summary {
          display: grid;
          gap: 10px;
        }

        .forecast-insights-provider-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .forecast-insights-provider-head,
        .forecast-insights-provider-row {
          display: grid;
          grid-template-columns: minmax(190px, 1.4fr) repeat(5, minmax(110px, 0.8fr));
          gap: 12px;
          min-width: 820px;
          align-items: center;
        }

        .forecast-insights-provider-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .forecast-insights-provider-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .forecast-insights-provider-row span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 13px;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .forecast-insights-provider-row strong {
          display: block;
          color: #fffaf4;
          font-size: 14px;
          line-height: 1.35;
        }

        .forecast-insights-provider-row small {
          display: block;
          margin-top: 4px;
          color: rgba(245, 242, 237, 0.44);
          font-size: 12px;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .alerts-mvp-note {
          display: grid;
          gap: 6px;
          border: 1px solid rgba(255, 122, 24, 0.22);
          border-radius: 18px;
          background: rgba(255, 122, 24, 0.08);
          padding: 16px 18px;
        }

        .alerts-mvp-note strong {
          color: #fffaf4;
          font-size: 14px;
        }

        .alerts-mvp-note span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 13px;
          line-height: 1.45;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .alert-severity-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: #fffaf4;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.1;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 6px 9px;
          text-align: center;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
          word-break: normal;
        }

        .alert-severity-badge.critical {
          border-color: rgba(255, 95, 86, 0.38);
          background: rgba(255, 95, 86, 0.12);
          color: #ff9b94;
        }

        .alert-severity-badge.warning {
          border-color: rgba(255, 183, 77, 0.38);
          background: rgba(255, 183, 77, 0.12);
          color: #ffd08a;
        }

        .alert-severity-badge.healthy {
          border-color: rgba(50, 213, 131, 0.38);
          background: rgba(50, 213, 131, 0.12);
          color: #7cf2b4;
        }

        .alert-severity-badge.unknown {
          border-color: rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(245, 242, 237, 0.72);
        }

        .alert-severity-badge.info {
          border-color: rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(245, 242, 237, 0.72);
        }

        .operator-priority-list,
        .alerts-summary-card {
          display: grid;
          gap: 10px;
        }

        .operator-priority-item,
        .alerts-summary-card div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .operator-priority-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .operator-priority-item.critical {
          border-color: rgba(255, 95, 86, 0.28);
          background: rgba(255, 95, 86, 0.08);
        }

        .operator-priority-item.warning {
          border-color: rgba(255, 183, 77, 0.24);
          background: rgba(255, 183, 77, 0.07);
        }

        .operator-priority-item.healthy {
          border-color: rgba(50, 213, 131, 0.24);
          background: rgba(50, 213, 131, 0.07);
        }

        .operator-priority-item.unknown {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }

        .operator-priority-item strong,
        .alerts-summary-card strong {
          display: block;
          color: #fffaf4;
          font-size: 15px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .operator-priority-item span,
        .operator-priority-item small,
        .alerts-summary-card span {
          display: block;
          margin-top: 5px;
          color: rgba(245, 242, 237, 0.58);
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .operator-priority-item small {
          color: #ffad66;
        }

        .alerts-table {
          display: grid;
          gap: 10px;
          max-width: 100%;
          overflow-x: auto;
        }

        .alerts-table-head,
        .alerts-table-row {
          display: grid;
          grid-template-columns:
            minmax(78px, 0.48fr)
            minmax(88px, 0.58fr)
            minmax(140px, 1fr)
            minmax(130px, 0.9fr)
            minmax(150px, 1fr)
            minmax(70px, 0.42fr)
            minmax(82px, 0.5fr)
            minmax(240px, 1.7fr);
          gap: 10px;
          min-width: 0;
          width: 100%;
          align-items: start;
        }

        .alerts-table-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .alerts-table-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .alerts-table-row strong,
        .alerts-table-row span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 12px;
          line-height: 1.4;
          max-width: 100%;
          min-width: 0;
          overflow-wrap: break-word;
          white-space: normal;
          word-break: normal;
        }

        .alerts-table-row strong {
          color: #fffaf4;
          font-size: 13px;
        }

        .alerts-table-head span,
        .alerts-table-row > span,
        .alerts-table-row > strong {
          min-width: 0;
        }

        .alerts-table-row > span:nth-child(6),
        .alerts-table-row > span:nth-child(7) {
          font-size: 11px;
          line-height: 1.35;
        }

        .alerts-table-row > span:nth-child(7) {
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          overflow-wrap: anywhere;
        }

        .alerts-table-row > span:nth-child(8) {
          line-height: 1.5;
        }

        .operator-priority-item .alert-severity-badge,
        .alerts-table-row .alert-severity-badge {
          display: inline-flex;
          margin-top: 0;
          font-size: 10px;
          line-height: 1.1;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 6px 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
          word-break: normal;
        }

        .data-quality-filters {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .data-quality-filters label {
          display: grid;
          gap: 8px;
        }

        .data-quality-filters span {
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .data-quality-filters select {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.24);
          color: #fffaf4;
          font: inherit;
          padding: 12px 14px;
        }

        .data-quality-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
          gap: 18px;
          align-items: start;
        }

        .quality-reason-list {
          display: grid;
          gap: 10px;
        }

        .quality-reason-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .quality-reason-row strong,
        .quality-status-card strong {
          display: block;
          color: #fffaf4;
          font-size: 15px;
          line-height: 1.35;
        }

        .quality-reason-row span,
        .quality-status-card span {
          display: block;
          margin-top: 6px;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          line-height: 1.5;
        }

        .quality-reason-row em {
          border-radius: 999px;
          background: rgba(255, 122, 24, 0.12);
          color: #ffad66;
          font-size: 13px;
          font-style: normal;
          font-weight: 900;
          min-width: 44px;
          padding: 8px 12px;
          text-align: center;
        }

        .quality-status-card {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.18);
          padding: 18px;
        }

        .quality-status-card.clean {
          border-color: rgba(50, 213, 131, 0.3);
          background: rgba(50, 213, 131, 0.08);
        }

        .quality-status-card.watch {
          border-color: rgba(255, 122, 24, 0.3);
          background: rgba(255, 122, 24, 0.08);
        }

        .quality-status-card.attention {
          border-color: rgba(255, 183, 77, 0.34);
          background: rgba(255, 183, 77, 0.08);
        }

        .quality-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: #fffaf4;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.15;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 7px 10px;
          text-align: center;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
          word-break: normal;
        }

        .quality-badge.clean {
          border-color: rgba(50, 213, 131, 0.34);
          background: rgba(50, 213, 131, 0.12);
          color: #7cf2b4;
        }

        .quality-badge.watch {
          border-color: rgba(255, 122, 24, 0.34);
          background: rgba(255, 122, 24, 0.12);
          color: #ffad66;
        }

        .quality-badge.attention {
          border-color: rgba(255, 183, 77, 0.34);
          background: rgba(255, 183, 77, 0.12);
          color: #ffd08a;
        }

        .rejected-records-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .rejected-records-head,
        .rejected-records-row {
          display: grid;
          grid-template-columns: minmax(170px, 1fr) minmax(220px, 1.3fr) minmax(180px, 1.1fr) minmax(170px, 1fr) minmax(110px, 0.7fr);
          gap: 12px;
          min-width: 980px;
          align-items: center;
        }

        .rejected-records-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .rejected-records-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .rejected-records-row span,
        .rejected-records-row small {
          color: rgba(245, 242, 237, 0.58);
          font-size: 12px;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .rejected-records-row strong {
          display: block;
          overflow: hidden;
          color: #fffaf4;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rejected-records-row small {
          display: block;
          margin-top: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .system-health-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
          gap: 18px;
          align-items: start;
        }

        .monitoring-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: #fffaf4;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.1;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 6px 9px;
          text-align: center;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
          word-break: normal;
        }

        .monitoring-badge.healthy {
          border-color: rgba(50, 213, 131, 0.34);
          background: rgba(50, 213, 131, 0.12);
          color: #7cf2b4;
        }

        .monitoring-badge.warning {
          border-color: rgba(255, 183, 77, 0.34);
          background: rgba(255, 183, 77, 0.12);
          color: #ffd08a;
        }

        .monitoring-badge.critical {
          border-color: rgba(255, 95, 86, 0.34);
          background: rgba(255, 95, 86, 0.12);
          color: #ff9b94;
        }

        .monitoring-badge.unknown {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(245, 242, 237, 0.62);
        }

        .platform-status-card {
          display: grid;
          gap: 16px;
        }

        .platform-status-card > strong {
          color: #fffaf4;
          font-size: 18px;
          letter-spacing: -0.03em;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .platform-status-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .platform-status-grid div,
        .system-signal-list div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .platform-status-grid span,
        .system-signal-list span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 700;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .platform-status-grid strong,
        .system-signal-list strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 16px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .system-signal-list {
          display: grid;
          gap: 10px;
        }

        .service-health-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .service-health-head,
        .service-health-row {
          display: grid;
          grid-template-columns: minmax(160px, 1fr) minmax(120px, 0.7fr) minmax(120px, 0.7fr) minmax(220px, 1.4fr);
          gap: 12px;
          min-width: 780px;
          align-items: center;
        }

        .service-health-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .service-health-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .service-health-row strong {
          color: #fffaf4;
          font-size: 14px;
        }

        .service-health-row span {
          color: rgba(245, 242, 237, 0.58);
          font-size: 12px;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .service-health-row span:nth-child(4) {
          overflow-wrap: break-word;
          word-break: normal;
        }

        .freshness-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: #fffaf4;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.1;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 6px 9px;
          text-align: center;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
          word-break: normal;
        }

        .freshness-badge.fresh {
          border-color: rgba(50, 213, 131, 0.34);
          background: rgba(50, 213, 131, 0.12);
          color: #7cf2b4;
        }

        .freshness-badge.stale {
          border-color: rgba(255, 183, 77, 0.34);
          background: rgba(255, 183, 77, 0.12);
          color: #ffd08a;
        }

        .freshness-badge.offline,
        .freshness-badge.no_data {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(245, 242, 237, 0.62);
        }

        .power-chart {
          display: grid;
          gap: 14px;
        }

        .chart-meta,
        .chart-range {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px;
          color: rgba(245, 242, 237, 0.56);
          font-size: 12px;
          font-weight: 700;
        }

        .power-chart svg {
          width: 100%;
          min-height: 220px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.18);
        }

        .power-chart line {
          stroke: rgba(245, 242, 237, 0.12);
          stroke-width: 1;
        }

        .power-chart polyline {
          fill: none;
          stroke: #ff8a2a;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 3;
        }

        .power-chart circle {
          fill: #ffb366;
          stroke: rgba(9, 9, 11, 0.9);
          stroke-width: 2;
        }

        .telemetry-status-card {
          display: grid;
          gap: 12px;
        }

        .telemetry-status-card div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .telemetry-status-card span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 700;
        }

        .telemetry-status-card strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 15px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .plants-list {
          display: grid;
          gap: 12px;
          max-width: 100%;
        }

        .solar-plant-form {
          display: grid;
          gap: 14px;
          margin-bottom: 18px;
          border: 1px solid rgba(255, 122, 24, 0.16);
          border-radius: 16px;
          background: rgba(255, 122, 24, 0.06);
          padding: 16px;
        }

        .solar-plant-form-heading {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .solar-plant-form-heading div {
          display: grid;
          gap: 4px;
        }

        .solar-plant-form-heading span,
        .solar-plant-form-grid span {
          color: rgba(245, 242, 237, 0.52);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .solar-plant-form-heading strong {
          color: #fffaf4;
          font-size: 17px;
          line-height: 1.3;
        }

        .solar-plant-form-heading p {
          margin: 0;
          max-width: 280px;
          color: rgba(245, 242, 237, 0.56);
          font-size: 12px;
          line-height: 1.45;
          text-align: right;
        }

        .solar-plant-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .solar-plant-form-grid label {
          display: grid;
          gap: 7px;
          min-width: 0;
        }

        .solar-plant-form-grid input,
        .solar-plant-form-grid select {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.22);
          color: #fffaf4;
          font: inherit;
          min-width: 0;
          padding: 10px 12px;
        }

        .solar-plant-form-message {
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.4;
          padding: 10px 12px;
        }

        .solar-plant-form-message.success {
          border: 1px solid rgba(107, 226, 190, 0.24);
          background: rgba(107, 226, 190, 0.09);
          color: #adf4df;
        }

        .solar-plant-form-message.error {
          border: 1px solid rgba(255, 111, 111, 0.28);
          background: rgba(255, 111, 111, 0.1);
          color: #ffb9b9;
        }

        .solar-plant-form-submit {
          justify-self: start;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff7a18, #ffb347);
          color: #1b120a;
          cursor: pointer;
          font: inherit;
          font-weight: 900;
          padding: 10px 18px;
        }

        .solar-plant-form-submit:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .plant-list-card {
          display: grid;
          gap: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          color: inherit;
          cursor: pointer;
          font: inherit;
          min-width: 0;
          padding: 14px;
          text-align: left;
          transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
          width: 100%;
        }

        .plant-list-card:hover,
        .plant-list-card:focus-visible {
          border-color: rgba(255, 122, 24, 0.42);
          background: rgba(255, 122, 24, 0.08);
          outline: none;
          transform: translateY(-1px);
        }

        .plant-list-card-main {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
          min-width: 0;
        }

        .plant-list-card-main strong {
          color: #fffaf4;
          font-size: 15px;
          line-height: 1.35;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .plant-list-card-meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          min-width: 0;
        }

        .plant-list-card-meta span {
          color: rgba(245, 242, 237, 0.58);
          display: grid;
          gap: 4px;
          font-size: 13px;
          line-height: 1.4;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .plant-list-card-meta small {
          color: rgba(245, 242, 237, 0.44);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .pilot-card {
          display: grid;
          gap: 16px;
        }

        .plant-profile-selector {
          display: grid;
          gap: 10px;
        }

        .plant-profile-selector label {
          display: grid;
          gap: 8px;
        }

        .plant-profile-selector span {
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .plant-profile-selector select {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.24);
          color: #fffaf4;
          font: inherit;
          min-width: 0;
          padding: 12px 14px;
        }

        .plant-profile-selector small {
          color: rgba(245, 242, 237, 0.52);
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .profile-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .profile-detail-grid div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          min-width: 0;
          padding: 14px;
        }

        .profile-detail-grid span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .profile-detail-grid strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 15px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .station-upload-card {
          display: grid;
          gap: 14px;
        }

        .station-upload-card p {
          margin: 0;
          color: rgba(245, 242, 237, 0.58);
          font-size: 13px;
          line-height: 1.45;
        }

        .station-upload-button {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff7a18, #ffb347);
          color: #1b120a;
          cursor: pointer;
          font-size: 13px;
          font-weight: 900;
          padding: 10px 16px;
        }

        .station-upload-button input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .station-upload-file {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .station-upload-file div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          min-width: 0;
          padding: 14px;
        }

        .station-upload-file span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .station-upload-file strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 14px;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .station-upload-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .station-upload-submit {
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          background: #ff7a18;
          color: #1b120a;
          cursor: pointer;
          font-size: 13px;
          font-weight: 900;
          padding: 10px 16px;
        }

        .station-upload-submit:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .station-upload-result {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .station-upload-result div {
          border: 1px solid rgba(50, 213, 131, 0.26);
          border-radius: 14px;
          background: rgba(50, 213, 131, 0.08);
          padding: 14px;
        }

        .station-upload-result span,
        .station-upload-message span {
          display: block;
          color: rgba(245, 242, 237, 0.62);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .station-upload-result strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 18px;
          line-height: 1.35;
        }

        .station-upload-message {
          display: grid;
          gap: 6px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.45;
          padding: 12px;
        }

        .station-upload-message.info {
          border: 1px solid rgba(255, 122, 24, 0.3);
          background: rgba(255, 122, 24, 0.08);
          color: #ffad66;
        }

        .station-upload-message.success {
          border: 1px solid rgba(50, 213, 131, 0.3);
          background: rgba(50, 213, 131, 0.08);
          color: #7cf2b4;
        }

        .station-upload-message.error {
          border: 1px solid rgba(255, 95, 86, 0.3);
          background: rgba(255, 95, 86, 0.08);
          color: #ffb4ad;
        }

        .station-upload-message.warning {
          border: 1px solid rgba(255, 183, 77, 0.3);
          background: rgba(255, 183, 77, 0.08);
        }

        .station-upload-last {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(50, 213, 131, 0.24);
          border-radius: 16px;
          background: rgba(50, 213, 131, 0.07);
          padding: 14px;
        }

        .station-upload-last > span,
        .station-upload-last div span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 12px;
          font-weight: 700;
        }

        .station-upload-last strong {
          color: #fffaf4;
          font-size: 15px;
          overflow-wrap: break-word;
          word-break: normal;
        }

        .station-upload-last div {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
        }

        .station-upload-last p {
          margin: 0;
          color: rgba(245, 242, 237, 0.68);
          font-size: 13px;
          line-height: 1.45;
        }

        .pilot-hero {
          border: 1px solid rgba(255, 122, 24, 0.2);
          border-radius: 18px;
          background: radial-gradient(circle at top left, rgba(255, 122, 24, 0.16), rgba(0, 0, 0, 0.2));
          padding: 18px;
        }

        .pilot-hero span,
        .pilot-grid span {
          display: block;
          color: rgba(245, 242, 237, 0.5);
          font-size: 12px;
          font-weight: 700;
        }

        .pilot-hero strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 24px;
          letter-spacing: -0.04em;
          line-height: 1.05;
        }

        .pilot-hero p {
          margin: 10px 0 0;
          color: rgba(245, 242, 237, 0.62);
          font-size: 13px;
        }

        .pilot-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .pilot-grid div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .pilot-grid strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 16px;
          line-height: 1.35;
        }

        .placeholder-panel {
          min-height: 360px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028));
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(28px, 5vw, 56px);
        }

        .placeholder-panel h2 {
          margin: 0;
          color: #fffaf4;
          font-size: clamp(30px, 5vw, 56px);
          letter-spacing: -0.055em;
          line-height: 1;
        }

        .placeholder-panel p:last-child {
          max-width: 620px;
          margin: 18px 0 0;
          color: rgba(245, 242, 237, 0.62);
          font-size: 16px;
          line-height: 1.7;
        }

        .panel-heading {
          margin-bottom: 16px;
        }

        .panel-heading span {
          color: #ff9b45;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .panel-heading h2 {
          margin: 6px 0 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .dependency-list,
        .table,
        .reason-list {
          display: grid;
          gap: 10px;
        }

        .dependency-row,
        .table-row,
        .reason-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .dependency-row strong,
        .table-row strong,
        .reason-row strong {
          display: block;
          color: #fffaf4;
          font-size: 14px;
        }

        .dependency-row span,
        .table-row span,
        .reason-row span,
        .dependency-meta small {
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
        }

        .dependency-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
        }

        .accuracy-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .accuracy-grid div {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 14px;
        }

        .accuracy-grid span,
        .rejected-total span {
          display: block;
          color: rgba(245, 242, 237, 0.54);
          font-size: 12px;
        }

        .accuracy-grid strong {
          display: block;
          margin-top: 8px;
          color: #fffaf4;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .rejected-summary {
          display: grid;
          gap: 14px;
        }

        .rejected-total {
          border: 1px solid rgba(255, 122, 24, 0.18);
          border-radius: 18px;
          background: rgba(255, 122, 24, 0.08);
          padding: 18px;
        }

        .rejected-total strong {
          display: block;
          color: #ffad66;
          font-size: 34px;
          letter-spacing: -0.05em;
          line-height: 1;
        }

        .empty-state {
          display: grid;
          gap: 6px;
          border-radius: 18px;
          color: rgba(245, 242, 237, 0.58);
          padding: 16px;
        }

        .empty-state strong {
          color: #fffaf4;
          font-size: 14px;
        }

        .empty-state span {
          font-size: 13px;
          line-height: 1.5;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(245, 242, 237, 0.72);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
          min-width: 0;
          overflow: hidden;
          overflow-wrap: normal;
          padding: 7px 10px;
          text-align: center;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
          word-break: normal;
        }

        .status-badge.good {
          border-color: rgba(50, 213, 131, 0.32);
          background: rgba(50, 213, 131, 0.1);
          color: #6ff0aa;
        }

        .status-badge.warning {
          border-color: rgba(255, 183, 77, 0.34);
          background: rgba(255, 183, 77, 0.1);
          color: #ffc06f;
        }

        .status-badge.muted {
          background: rgba(255, 255, 255, 0.04);
        }

        @media (max-width: 1180px) {
          .metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .panel-grid,
          .solar-layout,
          .plant-profile-layout,
          .accuracy-lab-layout,
          .providers-layout,
          .forecast-insights-layout,
          .alerts-layout,
          .telemetry-layout,
          .data-quality-layout,
          .system-health-layout {
            grid-template-columns: 1fr;
          }

          .alerts-table-head,
          .alerts-table-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .dashboard-shell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
            height: auto;
          }

          .nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workspace {
            padding: 20px;
          }

          .top-header {
            flex-direction: column;
          }

          .header-actions {
            flex-wrap: wrap;
          }

          .metric-grid,
          .solar-metric-grid,
          .accuracy-lab-metric-grid,
          .providers-metric-grid,
          .forecast-insights-metric-grid,
          .alerts-metric-grid,
          .telemetry-metric-grid,
          .data-quality-metric-grid,
          .system-health-metric-grid,
          .data-quality-filters,
          .accuracy-grid,
          .forecast-thresholds,
          .solar-plant-form-grid,
          .platform-status-grid {
            grid-template-columns: 1fr;
          }

          .solar-plant-form-heading {
            flex-direction: column;
          }

          .solar-plant-form-heading p {
            max-width: none;
            text-align: left;
          }

          .pilot-grid,
          .target-grid,
          .plant-list-card-meta,
          .station-upload-file,
          .station-upload-result,
          .profile-detail-grid {
            grid-template-columns: 1fr;
          }

          .alerts-table-head,
          .alerts-table-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const t = useMemo(() => createMessageTranslator(messages[locale]), [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <DashboardOverview locale={locale} onLocaleChange={setLocale} t={t} />
    </NextIntlClientProvider>
  );
}
