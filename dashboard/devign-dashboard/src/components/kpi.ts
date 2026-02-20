import {
  formatNumber,
  formatPercent01,
  formatSecondsToMMSS,
  trendFromDelta,
} from "@/lib/format";

export function getValue(summary: any, path: string) {
  // path like "kpis.sessions"
  const parts = path.split(".");
  let cur = summary;
  for (const p of parts) cur = cur?.[p];
  return cur;
}

export function getComparisonDelta(comparison: any, key: string) {
  // comparison.kpis.sessions.delta_pct etc.
  const node = comparison?.kpis?.[key];
  const delta = node?.delta_pct;
  return typeof delta === "number" ? delta : null;
}

export function getPreviousValue(comparison: any, key: string) {
  const node = comparison?.kpis?.[key];
  return node?.previous ?? null;
}

export function buildCoreKpis(summary: any, comparison: any) {
  const sessions = getValue(summary, "kpis.sessions");
  const newUsers = getValue(summary, "kpis.new_users");
  const activeUsers = getValue(summary, "kpis.active_users");
  const pageviews = getValue(summary, "kpis.pageviews");
  const engagement = getValue(summary, "kpis.engagement_rate_avg");

  return [
    {
      id: "new_users",
      label: "Nieuwe gebruikers",
      value: formatNumber(newUsers),
      prev: formatNumber(getPreviousValue(comparison, "new_users")),
      delta: getComparisonDelta(comparison, "new_users"),
      trend: trendFromDelta(getComparisonDelta(comparison, "new_users")),
      info: "Aantal bezoekers die je website voor het eerst bezoeken in deze periode.",
      fmtMissing: newUsers === null || newUsers === undefined,
    },
    {
      id: "active_users",
      label: "Actieve gebruikers",
      value: formatNumber(activeUsers),
      prev: formatNumber(getPreviousValue(comparison, "active_users")),
      delta: getComparisonDelta(comparison, "active_users"),
      trend: trendFromDelta(getComparisonDelta(comparison, "active_users")),
      info: "Aantal unieke actieve gebruikers in deze periode.",
      fmtMissing: activeUsers === null || activeUsers === undefined,
    },
    {
      id: "sessions",
      label: "Sessies",
      value: formatNumber(sessions),
      prev: formatNumber(getPreviousValue(comparison, "sessions")),
      delta: getComparisonDelta(comparison, "sessions"),
      trend: trendFromDelta(getComparisonDelta(comparison, "sessions")),
      info: "Aantal bezoeken (sessies). Eén gebruiker kan meerdere sessies hebben.",
      fmtMissing: sessions === null || sessions === undefined,
    },
    {
      id: "pageviews",
      label: "Paginaweergaven",
      value: formatNumber(pageviews),
      prev: formatNumber(getPreviousValue(comparison, "pageviews")),
      delta: getComparisonDelta(comparison, "pageviews"),
      trend: trendFromDelta(getComparisonDelta(comparison, "pageviews")),
      info: "Totaal aantal paginaweergaven in deze periode.",
      fmtMissing: pageviews === null || pageviews === undefined,
    },
    {
      id: "engagement_rate_avg",
      label: "Engagement rate",
      value: formatPercent01(engagement),
      prev: formatPercent01(
        getPreviousValue(comparison, "engagement_rate_avg"),
      ),
      delta: getComparisonDelta(comparison, "engagement_rate_avg"),
      trend: trendFromDelta(
        getComparisonDelta(comparison, "engagement_rate_avg"),
      ),
      info: "Percentage sessies met engagement. Hoger is doorgaans beter.",
      fmtMissing: engagement === null || engagement === undefined,
    },
  ];
}

export function buildTrafficKpis(summary: any, comparison: any) {
  const avgTime = getValue(summary, "kpis.avg_engagement_time_seconds_avg");
  const pps = getValue(summary, "kpis.pages_per_session_avg");
  const bounce = getValue(summary, "kpis.bounce_rate_avg");

  return [
    {
      id: "avg_eng_time",
      label: "Gem. engagement tijd",
      value: formatSecondsToMMSS(avgTime),
      prev: null,
      delta: null,
      trend: "flat",
      info: "Gemiddelde engagement tijd (afhankelijk van definitie).",
      fmtMissing: avgTime === null || avgTime === undefined,
    },
    {
      id: "pages_per_session",
      label: "Pagina’s per sessie",
      value:
        pps === null || pps === undefined
          ? null
          : String(Number(pps).toFixed(2)),
      prev: null,
      delta: null,
      trend: "flat",
      info: "Gemiddeld aantal pagina’s per sessie.",
      fmtMissing: pps === null || pps === undefined,
    },
    {
      id: "bounce_rate",
      label: "Bounce rate",
      value: formatPercent01(bounce),
      prev: null,
      delta: null,
      trend: "flat",
      info: "Bounce rate (GA4 definities). Kan null zijn als niet beschikbaar.",
      fmtMissing: bounce === null || bounce === undefined,
    },
  ];
}

export function buildMarketingKpis(summary: any, comparison: any) {
  const conv = getValue(summary, "kpis.conversions");
  const topQueries = summary?.top_queries;
  const topQuery =
    Array.isArray(topQueries) && topQueries.length
      ? topQueries[0]?.query
      : null;

  return [
    {
      id: "conversions",
      label: "Conversies",
      value: conv === null || conv === undefined ? null : String(conv),
      prev: null,
      delta: null,
      trend: "flat",
      info: "Belangrijke acties (bv. formulier, aankoop, offerte).",
      fmtMissing: conv === null || conv === undefined,
    },
    {
      id: "keywords",
      label: "Top zoekwoord",
      value: topQuery || null,
      prev: null,
      delta: null,
      trend: "flat",
      info: "Komt uit Google Search Console.",
      fmtMissing: !topQuery,
    },
  ];
}
