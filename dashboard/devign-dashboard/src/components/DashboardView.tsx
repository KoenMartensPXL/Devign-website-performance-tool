"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  Info,
  Mail,
  Globe,
  Instagram,
  Linkedin,
  Users,
  MousePointerClick,
  Eye,
  Activity,
} from "lucide-react";
import { monthLabel } from "@/lib/format";
import { buildCoreKpis, buildTrafficKpis, buildMarketingKpis } from "./kpi";
import React from "react";
import UsersOverTimeChart from "@/components/UsersOverTimeChart";
import Footer from "./Footer";

type Trend = "up" | "flat" | "down";
type KV = { key: string; value: number };

function TrendTag({ trend, delta }: { trend: Trend; delta: number }) {
  const cfg =
    trend === "up"
      ? {
          Icon: ArrowUpRight,
          cls: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20",
        }
      : trend === "down"
        ? {
            Icon: ArrowDownRight,
            cls: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20",
          }
        : {
            Icon: ArrowRight,
            cls: "bg-white/10 text-white/70 ring-1 ring-white/15",
          };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${cfg.cls}`}
    >
      <cfg.Icon className="h-3.5 w-3.5" />
      {delta >= 0 ? "+" : ""}
      {delta.toFixed(1)}%<span className="text-white/50">vs vorige maand</span>
    </span>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <div className="relative group">
      <Info className="h-4 w-4 text-white/35 group-hover:text-white/70" />
      <div className="pointer-events-none absolute right-0 top-6 z-10 w-72 rounded-xl border border-white/10 bg-black/90 p-3 text-xs text-white/80 opacity-0 shadow-lg backdrop-blur group-hover:opacity-100">
        {text}
      </div>
    </div>
  );
}

function MissingTag({ label = "Nog niet beschikbaar" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20 px-2 py-1 text-xs">
      {label}
    </span>
  );
}

function KpiCard({ kpi }: { kpi: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-white/60">{kpi.label}</div>
        <div className="flex items-center gap-2">
          {kpi.icon ? <div className="text-white/35">{kpi.icon}</div> : null}
          <InfoTip text={kpi.info} />
        </div>
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {kpi.value ?? <span className="text-white/40">—</span>}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {kpi.fmtMissing ? <MissingTag /> : null}
        {typeof kpi.delta === "number" && kpi.trend ? (
          <TrendTag trend={kpi.trend} delta={kpi.delta} />
        ) : (
          <span className="text-xs text-white/40">Geen vergelijking</span>
        )}
      </div>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: KV[] }) {
  const hasData = Array.isArray(items) && items.length > 0;
  const max = hasData ? Math.max(...items.map((i) => i.value), 1) : 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-white/90">{title}</div>

      {!hasData ? (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-white/40">
            Nog geen data (of 0 verkeer).
          </div>
          <MissingTag label="Lege lijst" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-sm text-white/90">
                  {String(it.key || "").trim() ? it.key : "(not set)"}
                </div>
                <div className="text-sm font-medium text-white/70">
                  {it.value}
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-white/25"
                  style={{ width: `${Math.round((it.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardView({
  customer,
  report,
  months,
  series,
  token,
}: {
  customer: any;
  report: any | null;
  months: string[];
  series: any[];
  token: string;
}) {
  // No report yet? still render UI
  const summary = report?.summary ?? {};
  const comparison = report?.comparison ?? {};

  const core = buildCoreKpis(summary, comparison).map((k: any) => {
    // add icons here (so you keep your current icons)
    const iconMap: any = {
      new_users: <Users className="h-5 w-5" />,
      active_users: <Activity className="h-5 w-5" />,
      sessions: <MousePointerClick className="h-5 w-5" />,
      pageviews: <Eye className="h-5 w-5" />,
      engagement_rate_avg: <Activity className="h-5 w-5" />,
    };
    return { ...k, icon: iconMap[k.id] };
  });

  const traffic = buildTrafficKpis(summary, comparison);
  const marketing = buildMarketingKpis(summary, comparison);

  // Lists from summary (always arrays)
  const topPages = Array.isArray(summary?.top_pages) ? summary.top_pages : [];
  const topCountries = Array.isArray(summary?.top_countries)
    ? summary.top_countries
    : [];
  const topSources = Array.isArray(summary?.top_sources)
    ? summary.top_sources
    : [];
  const deviceSplit = Array.isArray(summary?.device_split)
    ? summary.device_split
    : [];

  const monthText = report?.month
    ? monthLabel(report.month)
    : "Nog geen rapport";
  const reportTitle = report?.month
    ? `Rapport voor ${monthText}`
    : "Rapport wordt nog opgebouwd";
  const compareText = report?.comparison?.vs_month
    ? `Vergelijking met ${monthLabel(report.comparison.vs_month)}`
    : "Vergelijking volgt zodra er 2 maanden data zijn";

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-6">
            <Image
              src="/brand/pixelplusIconLogo.png"
              alt="Pixelplus"
              width={180}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-white">
                {customer?.name ?? "Klant"}
              </span>
              {/* <span className="text-sm text-white/50">
                {customer?.gsc_site_url ?? "—"}
              </span> */}
            </div>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            {months.length ? (
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap">
                {months.slice(0, 6).map((m) => (
                  <Link
                    key={m}
                    href={`/r/${token}?month=${m}`}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      report?.month === m
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {monthLabel(m)}
                  </Link>
                ))}
              </div>
            ) : (
              <span className="text-sm text-white/40">Nog geen maanden</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Banner */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">
                {reportTitle}
              </h1>
              <p className="mt-1 text-sm text-white/60">{compareText}</p>
              {!report ? (
                <p className="mt-2 text-sm text-amber-200/80">
                  Er is nog geen monthly_report record voor deze klant. Run je
                  monthly build job.
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50">Gegenereerd op</div>
              <div className="text-sm font-semibold text-white">
                {report?.generated_at
                  ? new Date(report.generated_at).toLocaleString("nl-BE")
                  : "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10">
              <Info className="h-4 w-4" />
              Uitleg KPI’s
            </button>

            <Link
              href="#"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              <Mail className="h-4 w-4" />
              Contacteer Pixelplus
            </Link>
          </div>
        </div>

        {/* Core KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {core.map((k: any) => (
            <KpiCard key={k.id} kpi={k} />
          ))}
        </div>

        {/* Traffic KPIs */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Web verkeer & gedrag
            </h2>
            <p className="text-sm text-white/60">
              Kernstatistieken over bezoekersgedrag en gebruikservaring.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {traffic.map((k: any) => (
                  <KpiCard key={k.id} kpi={k} />
                ))}
              </div>

              {/* Chart placeholder — later echte chart library */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold text-white/90">
                  Gebruikers over tijd
                </div>
                <UsersOverTimeChart
                  monthISO={
                    report?.month ??
                    new Date().toISOString().slice(0, 7) + "-01"
                  }
                  series={series}
                  metric="active_users"
                />
              </div>
            </div>

            <ListCard title="Apparaatgebruik" items={deviceSplit} />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Inhoud & interactie
            </h2>
            <p className="text-sm text-white/60">
              Welke pagina’s presteren goed en waar haken bezoekers af?
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ListCard
              title="Meest bezochte pagina’s (Top 5)"
              items={topPages}
            />
            <ListCard title="Top landen (Top 5)" items={topCountries} />
          </div>
        </div>

        {/* Marketing */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Resultaat & marketing
            </h2>
            <p className="text-sm text-white/60">
              Conversies en herkomst van bezoekers (optioneel: Search Console).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-3">
              {marketing.map((k: any) => (
                <KpiCard key={k.id} kpi={k} />
              ))}
            </div>
            <div className="lg:col-span-2">
              <ListCard title="Verkeersbronnen (Top 5)" items={topSources} />
            </div>
          </div>
        </div>

        {/* Geo */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Geografische spreiding
            </h2>
            <p className="text-sm text-white/60">
              Wereldkaart + top landen met meeste bezoekers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/90">
                  Wereldkaart
                </div>
                <div className="text-white/40">
                  <Globe className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 h-[280px] rounded-xl border border-dashed border-white/15 bg-black/30 flex items-center justify-center text-sm text-white/50">
                Map placeholder (later echte kaart)
              </div>
            </div>

            <ListCard title="Top landen" items={topCountries} />
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}
