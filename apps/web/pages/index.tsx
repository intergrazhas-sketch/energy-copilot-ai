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

type ForecastProvider = {
  id: string;
  code: string;
  name: string;
  provider_type: string;
  is_active: boolean;
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

type DashboardData = {
  health: HealthResponse | null;
  system: SystemStatusResponse | null;
  plants: SolarPlant[];
  providers: ForecastProvider[];
  accuracy: AccuracySummary | null;
  accuracyRanking: AccuracyProviderRankingResponse | null;
  rejected: RejectedTelemetrySummary | null;
};

type DashboardState = {
  loading: boolean;
  error: string | null;
  data: DashboardData;
};

type Locale = "en" | "ru" | "kz";
type MessageValue = string | number;
type Translate = (key: string, values?: Record<string, MessageValue>) => string;

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";

const navigationItems = [
  { key: "overview", labelKey: "overview" },
  { key: "solar-plants", labelKey: "solarPlants" },
  { key: "forecast-accuracy-lab", labelKey: "forecastAccuracyLab" },
  { key: "forecast-providers", labelKey: "forecastProviders" },
  { key: "telemetry", labelKey: "telemetry" },
  { key: "rejected-telemetry", labelKey: "rejectedTelemetry" },
  { key: "system-status", labelKey: "systemStatus" },
] as const;

type SectionKey = (typeof navigationItems)[number]["key"];

const locales: Locale[] = ["en", "ru", "kz"];

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
  accuracy: null,
  accuracyRanking: null,
  rejected: null,
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

function formatNumber(value: number | null | undefined, digits = 1, fallback = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number | null | undefined, fallback = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${formatNumber(value, 2, fallback)}%`;
}

function normalizeReason(value: string) {
  return value.replaceAll("_", " ");
}

function formatCapacityMw(valueKw: number, fallback: string) {
  return `${formatNumber(valueKw / 1000, 2, fallback)} MW`;
}

function formatPlantLocation(plant: SolarPlant, fallback: string) {
  if (plant.latitude === null || plant.latitude === undefined) {
    return fallback;
  }

  if (plant.longitude === null || plant.longitude === undefined) {
    return fallback;
  }

  return `${formatNumber(plant.latitude, 4, fallback)}, ${formatNumber(
    plant.longitude,
    4,
    fallback,
  )}`;
}

function formatDate(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status, t }: { status?: string; t: Translate }) {
  const normalized = status || "unknown";
  const displayStatus = ["ok", "active", "inactive", "degraded", "open", "unknown"].includes(
    normalized,
  )
    ? t(`status.${normalized}`)
    : normalized;
  const tone =
    normalized === "ok" || normalized === "active"
      ? "good"
      : normalized === "degraded" || normalized === "open"
        ? "warning"
        : "muted";

  return <span className={`status-badge ${tone}`}>{displayStatus}</span>;
}

function MetricCard({
  label,
  value,
  helper,
  loading,
  t,
}: {
  label: string;
  value: string;
  helper: string;
  loading: boolean;
  t: Translate;
}) {
  return (
    <section className="metric-card">
      <p>{label}</p>
      <strong>{loading ? t("common.loading") : value}</strong>
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
  t,
}: {
  plants: SolarPlant[];
  loading: boolean;
  t: Translate;
}) {
  const noData = t("common.noData");
  const totalCapacityKw = plants.reduce((sum, plant) => sum + plant.capacity_kw, 0);
  const activePlants = plants.filter((plant) => plant.status === "active").length;

  return (
    <section className="section-stack">
      <section className="metric-grid solar-metric-grid">
        <MetricCard
          helper={t("solarPlants.kpi.totalPlantsHelper")}
          label={t("solarPlants.kpi.totalPlants")}
          loading={loading}
          t={t}
          value={formatNumber(plants.length, 0, noData)}
        />
        <MetricCard
          helper={t("solarPlants.kpi.activePlantsHelper")}
          label={t("solarPlants.kpi.activePlants")}
          loading={loading}
          t={t}
          value={formatNumber(activePlants, 0, noData)}
        />
        <MetricCard
          helper={formatCapacityMw(totalCapacityKw, noData)}
          label={t("solarPlants.kpi.totalCapacity")}
          loading={loading}
          t={t}
          value={t("solarPlants.kpi.capacityValue", {
            kw: formatNumber(totalCapacityKw, 0, noData),
            mw: formatNumber(totalCapacityKw / 1000, 2, noData),
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
          {loading ? (
            <EmptyState detail={t("solarPlants.loadingDetail")} title={t("solarPlants.loadingTitle")} />
          ) : plants.length > 0 ? (
            <div className="plants-table">
              <div className="plants-table-head">
                <span>{t("solarPlants.table.name")}</span>
                <span>{t("solarPlants.table.capacity")}</span>
                <span>{t("solarPlants.table.status")}</span>
                <span>{t("solarPlants.table.timezone")}</span>
                <span>{t("solarPlants.table.location")}</span>
                <span>{t("solarPlants.table.createdAt")}</span>
              </div>
              {plants.map((plant) => (
                <div className="plants-table-row" key={plant.id}>
                  <strong>{plant.name}</strong>
                  <span>
                    {t("solarPlants.table.capacityValue", {
                      kw: formatNumber(plant.capacity_kw, 0, noData),
                      mw: formatNumber(plant.capacity_kw / 1000, 2, noData),
                    })}
                  </span>
                  <span>
                    <StatusBadge status={plant.status} t={t} />
                  </span>
                  <span>{plant.timezone || noData}</span>
                  <span>{formatPlantLocation(plant, noData)}</span>
                  <span>{formatDate(plant.created_at, noData)}</span>
                </div>
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

function ForecastAccuracyLabSection({
  summary,
  ranking,
  loading,
  t,
}: {
  summary: AccuracySummary | null;
  ranking: AccuracyProviderRankingResponse | null;
  loading: boolean;
  t: Translate;
}) {
  const noData = t("common.noData");
  const targetStatus = getAccuracyTargetStatus(summary?.avg_mape);
  const rankingProviders = ranking?.providers || [];
  const hasAggregates = Boolean(summary && summary.aggregates_count > 0);

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
          value={formatPercent(summary?.avg_mape, noData)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.avgRmseHelper")}
          label={t("accuracyLab.kpi.avgRmse")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.avg_rmse, 2, noData)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.avgMaeHelper")}
          label={t("accuracyLab.kpi.avgMae")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.avg_mae, 2, noData)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.avgBiasHelper")}
          label={t("accuracyLab.kpi.avgBias")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.avg_bias, 2, noData)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.samplesHelper")}
          label={t("accuracyLab.kpi.samples")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.samples_count, 0, noData)}
        />
        <MetricCard
          helper={t("accuracyLab.kpi.forecastRunsHelper")}
          label={t("accuracyLab.kpi.forecastRuns")}
          loading={loading}
          t={t}
          value={formatNumber(summary?.forecast_runs_count, 0, noData)}
        />
      </section>

      <section className="accuracy-lab-layout">
        <Panel eyebrow={t("accuracyLab.target.eyebrow")} title={t("accuracyLab.target.title")}>
          <div className="target-card">
            <div className={`target-status ${targetStatus}`}>
              <span>{t("accuracyLab.target.currentMape")}</span>
              <strong>{formatPercent(summary?.avg_mape, noData)}</strong>
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
                    <strong>{provider.provider_name}</strong>
                    <small>{provider.provider_code}</small>
                  </span>
                  <span>{formatPercent(provider.avg_mape, noData)}</span>
                  <span>{formatNumber(provider.avg_rmse, 2, noData)}</span>
                  <span>{formatNumber(provider.avg_mae, 2, noData)}</span>
                  <span>{formatNumber(provider.avg_bias, 2, noData)}</span>
                  <span>{formatNumber(provider.samples_count, 0, noData)}</span>
                  <span>{formatNumber(provider.forecast_runs_count, 0, noData)}</span>
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
  isActive?: boolean;
  avgMape: number | null;
  avgRmse: number | null;
  forecastRunsCount: number | null;
  rank: number | null;
};

function buildForecastProviderRows(
  providers: ForecastProvider[],
  ranking: AccuracyProviderRankingResponse | null,
) {
  const rankingProviders = ranking?.providers || [];
  const rankingById = new Map(rankingProviders.map((provider) => [provider.provider_id, provider]));
  const rankingByCode = new Map(rankingProviders.map((provider) => [provider.provider_code, provider]));
  const rows = providers.map<ForecastProviderRow>((provider) => {
    const providerRanking = rankingById.get(provider.id) || rankingByCode.get(provider.code);
    return {
      id: provider.id,
      name: provider.name,
      code: provider.code,
      isActive: provider.is_active,
      avgMape: providerRanking?.avg_mape ?? null,
      avgRmse: providerRanking?.avg_rmse ?? null,
      forecastRunsCount: providerRanking?.forecast_runs_count ?? null,
      rank: providerRanking?.rank ?? null,
    };
  });

  const providerIds = new Set(providers.map((provider) => provider.id));
  rankingProviders.forEach((provider) => {
    if (providerIds.has(provider.provider_id)) {
      return;
    }
    rows.push({
      id: provider.provider_id,
      name: provider.provider_name,
      code: provider.provider_code,
      avgMape: provider.avg_mape,
      avgRmse: provider.avg_rmse,
      forecastRunsCount: provider.forecast_runs_count,
      rank: provider.rank,
    });
  });

  return rows.sort((first, second) => {
    if (first.rank !== null && second.rank !== null) {
      return first.rank - second.rank;
    }
    if (first.rank !== null) {
      return -1;
    }
    if (second.rank !== null) {
      return 1;
    }
    return first.name.localeCompare(second.name);
  });
}

function ForecastProvidersSection({
  providers,
  ranking,
  loading,
  t,
}: {
  providers: ForecastProvider[];
  ranking: AccuracyProviderRankingResponse | null;
  loading: boolean;
  t: Translate;
}) {
  const noData = t("common.noData");
  const rows = buildForecastProviderRows(providers, ranking);
  const rankedRows = rows.filter(
    (provider) => provider.avgMape !== null && !Number.isNaN(provider.avgMape),
  );
  const bestProvider = rankedRows[0];
  const worstProvider = rankedRows[rankedRows.length - 1];
  const mapeDelta =
    bestProvider && worstProvider && bestProvider.avgMape !== null && worstProvider.avgMape !== null
      ? worstProvider.avgMape - bestProvider.avgMape
      : null;
  const activeProviders = providers.filter((provider) => provider.is_active).length;
  const totalForecastRuns = rows.reduce(
    (sum, provider) => sum + (provider.forecastRunsCount || 0),
    0,
  );

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
          value={formatNumber(providers.length, 0, noData)}
        />
        <MetricCard
          helper={t("forecastProviders.kpi.activeProvidersHelper")}
          label={t("forecastProviders.kpi.activeProviders")}
          loading={loading}
          t={t}
          value={formatNumber(activeProviders, 0, noData)}
        />
        <MetricCard
          helper={t("forecastProviders.kpi.forecastRunsHelper")}
          label={t("forecastProviders.kpi.forecastRuns")}
          loading={loading}
          t={t}
          value={formatNumber(totalForecastRuns, 0, noData)}
        />
        <MetricCard
          helper={t("forecastProviders.kpi.bestProviderHelper")}
          label={t("forecastProviders.kpi.bestProvider")}
          loading={loading}
          t={t}
          value={bestProvider?.name || noData}
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
                <span>{t("forecastProviders.table.code")}</span>
                <span>{t("forecastProviders.table.status")}</span>
                <span>{t("forecastProviders.table.avgMape")}</span>
                <span>{t("forecastProviders.table.avgRmse")}</span>
                <span>{t("forecastProviders.table.forecastRuns")}</span>
                <span>{t("forecastProviders.table.rank")}</span>
              </div>
              {rows.map((provider) => (
                <div className="providers-table-row" key={provider.id}>
                  <strong>{provider.name}</strong>
                  <span>{provider.code}</span>
                  <StatusBadge status={provider.isActive ? "active" : "inactive"} t={t} />
                  <span>{formatPercent(provider.avgMape, noData)}</span>
                  <span>{formatNumber(provider.avgRmse, 2, noData)}</span>
                  <span>{formatNumber(provider.forecastRunsCount, 0, noData)}</span>
                  <span>{provider.rank ? `#${provider.rank}` : noData}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState detail={t("providers.emptyDetail")} title={t("providers.emptyTitle")} />
          )}
        </Panel>

        <Panel
          eyebrow={t("forecastProviders.comparison.eyebrow")}
          title={t("forecastProviders.comparison.title")}
        >
          {loading ? (
            <EmptyState detail={t("providers.loadingDetail")} title={t("providers.loadingTitle")} />
          ) : rankedRows.length > 0 ? (
            <div className="provider-comparison-card">
              <div>
                <span>{t("forecastProviders.comparison.bestProvider")}</span>
                <strong>{bestProvider?.name || noData}</strong>
                <small>{formatPercent(bestProvider?.avgMape, noData)}</small>
              </div>
              <div>
                <span>{t("forecastProviders.comparison.worstProvider")}</span>
                <strong>{worstProvider?.name || noData}</strong>
                <small>{formatPercent(worstProvider?.avgMape, noData)}</small>
              </div>
              <div className="provider-delta">
                <span>{t("forecastProviders.comparison.mapeDelta")}</span>
                <strong>{formatPercent(mapeDelta, noData)}</strong>
              </div>
            </div>
          ) : (
            <EmptyState
              detail={t("forecastProviders.comparison.emptyDetail")}
              title={t("forecastProviders.comparison.emptyTitle")}
            />
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

      const [health, system, plants, providers, accuracy, accuracyRanking, rejected] =
        await Promise.allSettled([
        fetchJson<HealthResponse>("/health"),
        fetchJson<SystemStatusResponse>("/api/v1/system/status"),
        fetchJson<SolarPlant[]>("/api/v1/solar-plants"),
        fetchJson<ForecastProvider[]>("/api/v1/forecast-providers"),
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
      ]);

      if (!mounted) {
        return;
      }

      const nextData: DashboardData = {
        health: health.status === "fulfilled" ? health.value : null,
        system: system.status === "fulfilled" ? system.value : null,
        plants: plants.status === "fulfilled" ? plants.value : [],
        providers: providers.status === "fulfilled" ? providers.value : [],
        accuracy: accuracy.status === "fulfilled" ? accuracy.value : null,
        accuracyRanking: accuracyRanking.status === "fulfilled" ? accuracyRanking.value : null,
        rejected: rejected.status === "fulfilled" ? rejected.value : null,
      };

      const hasAnyData =
        Boolean(nextData.health) ||
        Boolean(nextData.system) ||
        nextData.plants.length > 0 ||
        nextData.providers.length > 0 ||
        Boolean(nextData.accuracy) ||
        Boolean(nextData.accuracyRanking) ||
        Boolean(nextData.rejected);

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
  }, [period.from, period.to]);

  const totalCapacity = state.data.plants.reduce(
    (sum, plant) => sum + plant.capacity_kw,
    0,
  );
  const activeProviders = state.data.providers.filter((provider) => provider.is_active).length;
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
                value={systemStatus || noData}
              />
              <MetricCard
                helper={t("metrics.totalCapacity", {
                  value: formatNumber(totalCapacity, 0, noData),
                })}
                label={t("metrics.solarPlants")}
                loading={state.loading}
                t={t}
                value={formatNumber(state.data.plants.length, 0, noData)}
              />
              <MetricCard
                helper={t("common.activeProviders", { count: activeProviders })}
                label={t("metrics.forecastProviders")}
                loading={state.loading}
                t={t}
                value={formatNumber(state.data.providers.length, 0, noData)}
              />
              <MetricCard
                helper={t("common.samples", {
                  count: formatNumber(state.data.accuracy?.samples_count, 0, noData),
                })}
                label={t("metrics.accuracyMape")}
                loading={state.loading}
                t={t}
                value={formatPercent(state.data.accuracy?.avg_mape, noData)}
              />
              <MetricCard
                helper={t("metrics.openTelemetryIssues")}
                label={t("metrics.rejectedTelemetry")}
                loading={state.loading}
                t={t}
                value={formatNumber(state.data.rejected?.total, 0, noData)}
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
                          value: formatNumber(dependency.latency_ms, 0, noData),
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
                          value: formatNumber(plant.capacity_kw, 0, noData),
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
                  <strong>{formatPercent(state.data.accuracy.avg_mape, noData)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.avgRmse")}</span>
                  <strong>{formatNumber(state.data.accuracy.avg_rmse, 2, noData)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.avgMae")}</span>
                  <strong>{formatNumber(state.data.accuracy.avg_mae, 2, noData)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.avgBias")}</span>
                  <strong>{formatNumber(state.data.accuracy.avg_bias, 2, noData)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.forecastRuns")}</span>
                  <strong>{formatNumber(state.data.accuracy.forecast_runs_count, 0, noData)}</strong>
                </div>
                <div>
                  <span>{t("accuracy.aggregates")}</span>
                  <strong>{formatNumber(state.data.accuracy.aggregates_count, 0, noData)}</strong>
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
                      <strong>{provider.name}</strong>
                      <span>{provider.code} / {provider.provider_type}</span>
                    </div>
                    <StatusBadge status={provider.is_active ? "active" : "inactive"} t={t} />
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
                  <strong>{formatNumber(state.data.rejected.total, 0, noData)}</strong>
                  <span>{t("rejectedTelemetry.openMessages")}</span>
                </div>
                {topRejectedReasons.length > 0 ? (
                  <div className="reason-list">
                    {topRejectedReasons.map((item) => (
                      <div className="reason-row" key={item.reason}>
                        <span>{normalizeReason(item.reason)}</span>
                        <strong>{formatNumber(item.count, 0)}</strong>
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
          <SolarPlantsSection plants={state.data.plants} loading={state.loading} t={t} />
        ) : activeSection === "forecast-accuracy-lab" ? (
          <ForecastAccuracyLabSection
            loading={state.loading}
            ranking={state.data.accuracyRanking}
            summary={state.data.accuracy}
            t={t}
          />
        ) : activeSection === "forecast-providers" ? (
          <ForecastProvidersSection
            loading={state.loading}
            providers={state.data.providers}
            ranking={state.data.accuracyRanking}
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

        .metric-card,
        .panel,
        .empty-state {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028));
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
        }

        .metric-card {
          min-height: 136px;
          border-radius: 18px;
          padding: 18px;
        }

        .metric-card p,
        .metric-card span {
          margin: 0;
          color: rgba(245, 242, 237, 0.56);
          font-size: 13px;
        }

        .metric-card strong {
          display: block;
          margin: 18px 0 10px;
          color: #fffaf4;
          font-size: clamp(24px, 3vw, 34px);
          letter-spacing: -0.05em;
          line-height: 1;
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
        }

        .ranking-table-row small {
          display: block;
          margin-top: 4px;
          color: rgba(245, 242, 237, 0.44);
          font-size: 12px;
        }

        .providers-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .providers-table-head,
        .providers-table-row {
          display: grid;
          grid-template-columns: minmax(170px, 1.3fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) repeat(4, minmax(100px, 0.8fr));
          gap: 12px;
          min-width: 880px;
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
        }

        .providers-table-row span {
          color: rgba(245, 242, 237, 0.62);
          font-size: 13px;
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
        }

        .provider-comparison-card small {
          margin-top: 8px;
          color: #ffad66;
        }

        .plants-table {
          display: grid;
          gap: 10px;
          overflow-x: auto;
        }

        .plants-table-head,
        .plants-table-row {
          display: grid;
          grid-template-columns: minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(100px, 0.7fr) minmax(130px, 1fr) minmax(150px, 1fr) minmax(120px, 0.9fr);
          gap: 12px;
          min-width: 920px;
          align-items: center;
        }

        .plants-table-head {
          color: rgba(245, 242, 237, 0.46);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0 12px;
          text-transform: uppercase;
        }

        .plants-table-row {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.18);
          padding: 12px;
        }

        .plants-table-row strong {
          color: #fffaf4;
          font-size: 14px;
        }

        .plants-table-row span {
          color: rgba(245, 242, 237, 0.58);
          font-size: 13px;
        }

        .pilot-card {
          display: grid;
          gap: 16px;
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
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(245, 242, 237, 0.72);
          font-size: 12px;
          font-weight: 800;
          min-width: 68px;
          padding: 7px 10px;
          text-transform: uppercase;
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
          .accuracy-lab-layout,
          .providers-layout {
            grid-template-columns: 1fr;
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
          .accuracy-grid {
            grid-template-columns: 1fr;
          }

          .pilot-grid,
          .target-grid {
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
