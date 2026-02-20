import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  Info,
  Calendar,
  Mail,
  Users,
  MousePointerClick,
  Eye,
  Activity,
  Globe,
  Instagram,
  Linkedin,
} from "lucide-react";
import Image from "next/image";
import { NextDataPathnameNormalizer } from "next/dist/server/normalizers/request/next-data";

type Trend = "up" | "flat" | "down";

type KPI = {
  id: string;
  label: string;
  value: string | null;
  prev?: string | null;
  delta?: number | null; // percent
  trend?: Trend;
  info: string;
  icon?: React.ReactNode;
};

type KV = { key: string; value: number };

const mock = {
  customerName: "TechStart BV",
  website: "techstart.nl",
  reportTitle: "Rapport voor Januari 2026",
  compareText: "Vergelijking met December 2025",
  lastUpdated: "18 februari 2026, 00:00",
  nextUpdate: "19 feb 2026, 00:00",

  // 5 core KPI's (bovenaan)
  coreKpis: [
    {
      id: "new_users",
      label: "Nieuwe gebruikers",
      value: "12.847",
      prev: "10.237",
      delta: 25.5,
      trend: "up",
      info: "Aantal bezoekers die je website voor het eerst bezoeken in deze periode.",
      icon: <Users className="h-5 w-5" />,
    },
    {
      id: "active_users",
      label: "Actieve gebruikers",
      value: "18.293",
      prev: "15.785",
      delta: 15.9,
      trend: "up",
      info: "Aantal unieke actieve gebruikers in deze periode.",
      icon: <Activity className="h-5 w-5" />,
    },
    {
      id: "sessions",
      label: "Sessies",
      value: "24.561",
      prev: "21.345",
      delta: 15.1,
      trend: "up",
      info: "Aantal bezoeken (sessies). Eén gebruiker kan meerdere sessies hebben.",
      icon: <MousePointerClick className="h-5 w-5" />,
    },
    {
      id: "pageviews",
      label: "Paginaweergaven",
      value: "89.234",
      prev: "76.450",
      delta: 16.6,
      trend: "up",
      info: "Totaal aantal paginaweergaven in deze periode.",
      icon: <Eye className="h-5 w-5" />,
    },
    {
      id: "engagement",
      label: "Engagement rate",
      value: "68.5%",
      prev: "64.2%",
      delta: 6.7,
      trend: "up",
      info: "Percentage sessies met engagement. Hoger is doorgaans beter.",
      icon: <Activity className="h-5 w-5" />,
    },
  ] as KPI[],

  // Web verkeer & gedrag (alleen KPI's die hier echt bij horen)
  trafficKpis: [
    {
      id: "avg_eng_time",
      label: "Gem. engagement tijd",
      value: "1m 42s",
      prev: "1m 45s",
      delta: -1.7,
      trend: "flat",
      info: "Gemiddelde engagement tijd per gebruiker/sessie (afhankelijk van gekozen definitie).",
    },
    {
      id: "pages_per_session",
      label: "Pagina’s per sessie",
      value: "3.2",
      prev: "3.0",
      delta: 6.7,
      trend: "up",
      info: "Gemiddeld aantal pagina’s dat bezoekers bekijken per sessie.",
    },
    {
      id: "bounce_or_eng",
      label: "Bounce / Eng. (keuze)",
      value: null, // simulatie: nog geen data
      prev: null,
      delta: null,
      trend: "flat",
      info: "In GA4 wordt vaak engagement rate gebruikt. Bounce rate is anders dan in Universal Analytics.",
    },
  ] as KPI[],

  // Content & interactie
  contentKpis: [
    {
      id: "load_time",
      label: "Gem. laadtijd",
      value: "1.8s",
      prev: "2.1s",
      delta: -14.3,
      trend: "up",
      info: "Gemiddelde laadtijd. Lager is beter (sneller).",
    },
    {
      id: "events",
      label: "Belangrijke events",
      value: "1.204",
      prev: "980",
      delta: 22.9,
      trend: "up",
      info: "Belangrijke interacties zoals klikken, formulierverzendingen, downloads, …",
    },
    {
      id: "exit_rate",
      label: "Uitstapgedrag",
      value: "Top uitstappagina’s",
      prev: "Top uitstappagina’s",
      delta: null,
      trend: "flat",
      info: "Pagina’s waar bezoekers het vaakst je website verlaten.",
    },
  ] as KPI[],

  // Resultaat & marketing
  marketingKpis: [
    {
      id: "conversions",
      label: "Conversies",
      value: "96",
      prev: "84",
      delta: 14.3,
      trend: "up",
      info: "Belangrijke acties (bv. contactformulier, aankoop, offerte-aanvraag).",
    },

    {
      id: "keywords",
      label: "Top zoekwoord",
      value: null, // simulatie: nog geen search console
      prev: null,
      delta: null,
      trend: "flat",
      info: "Komt uit Google Search Console (optioneel).",
    },
  ] as KPI[],

  // Visual blocks (tabellen/grafieken)
  deviceSplit: [
    { key: "Mobiel", value: 62 },
    { key: "Desktop", value: 35 },
    { key: "Tablet", value: 3 },
  ] as KV[],

  topPages: [
    { key: "/", value: 1820 },
    { key: "/diensten", value: 940 },
    { key: "/contact", value: 610 },
    { key: "/cases", value: 480 },
    { key: "/blog/seo", value: 360 },
  ] as KV[],

  exitPages: [
    { key: "/contact", value: 240 },
    { key: "/pricing", value: 210 },
    { key: "/blog", value: 180 },
    { key: "/diensten", value: 160 },
    { key: "/cases", value: 120 },
  ] as KV[],

  sources: [
    { key: "Organic Search", value: 54 },
    { key: "Direct", value: 28 },
    { key: "Referral", value: 12 },
    { key: "Paid", value: 6 },
  ] as KV[],

  countries: [
    { key: "Belgium", value: 1530 },
    { key: "Netherlands", value: 410 },
    { key: "France", value: 120 },
    { key: "Germany", value: 95 },
    { key: "UK", value: 60 },
  ] as KV[],
};

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

function EmptyValue({ label = "Nog geen data" }: { label?: string }) {
  return <span className="text-white/40">{label}</span>;
}

function KpiCard({ kpi }: { kpi: KPI }) {
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
        {kpi.value ? kpi.value : <EmptyValue />}
      </div>

      <div className="mt-1 text-xs text-white/50">
        Vorige maand:{" "}
        <span className="text-white/70">{kpi.prev ? kpi.prev : "—"}</span>
      </div>

      <div className="mt-3">
        {typeof kpi.delta === "number" && kpi.trend ? (
          <TrendTag trend={kpi.trend} delta={kpi.delta} />
        ) : (
          <span className="text-xs text-white/40">Geen vergelijking</span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/60">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ListCard({ title, items }: { title: string; items: KV[] }) {
  const hasData = items && items.length > 0;
  const max = hasData ? Math.max(...items.map((i) => i.value), 1) : 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-white/90">{title}</div>

      {!hasData ? (
        <div className="mt-4 text-sm text-white/40">Nog geen data.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-sm text-white/90">{it.key}</div>
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

function MiniBars({
  title,
  items,
  unit = "%",
}: {
  title: string;
  items: KV[];
  unit?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">{title}</div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <div key={it.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/80">{it.key}</div>
              <div className="text-sm text-white/60">
                {it.value}
                {unit}
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
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Topbar */}
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-6">
            {/* Pixelplus Wordmark */}
            <div className="flex items-center">
              <Image
                src="/brand/pixelplusIconLogo.png"
                alt="Pixelplus"
                width={180}
                height={32}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-white/10" />

            {/* Client Info */}
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-white">
                TechStart BV
              </span>
              <span className="text-sm text-white/50">techstart.nl</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Report banner */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">
                {mock.reportTitle}
              </h1>
              <p className="mt-1 text-sm text-white/60">
                {mock.compareText} — Data automatisch bijgewerkt op{" "}
                {mock.lastUpdated}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50">Volgende update</div>
              <div className="text-sm font-semibold text-white">
                {mock.nextUpdate}
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
        {/* Core KPI row (only 5) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {mock.coreKpis.map((k) => (
            <KpiCard key={k.id} kpi={k} />
          ))}
        </div>
        {/* Section: Traffic & Behavior */}
        <Section
          title="Web verkeer & gedrag"
          subtitle="Kernstatistieken over bezoekersgedrag en gebruikservaring."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mock.trafficKpis.map((k) => (
                  <KpiCard key={k.id} kpi={k} />
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold text-white/90">
                  Gebruikers over tijd
                </div>
                <div className="mt-4 h-[220px] rounded-xl border border-dashed border-white/15 bg-black/30">
                  <div className="flex h-full items-center justify-center text-sm text-white/50">
                    Grafiek placeholder (later echte lijnchart)
                  </div>
                </div>
              </div>
            </div>

            <MiniBars
              title="Apparaatgebruik"
              items={mock.deviceSplit}
              unit="%"
            />
          </div>
        </Section>
        {/* Section: Content & Interaction */}
        <Section
          title="Inhoud & interactie"
          subtitle="Welke pagina’s presteren goed en waar haken bezoekers af?"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="grid grid-cols-1 gap-3">
                {mock.contentKpis
                  .filter((k) => k.id !== "exit_rate")
                  .map((k) => (
                    <KpiCard key={k.id} kpi={k} />
                  ))}
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 gap-6 md:grid-cols-2">
              <ListCard
                title="Meest bezochte pagina’s (Top 5)"
                items={mock.topPages}
              />
              <ListCard
                title="Uitstappagina’s (Top 5)"
                items={mock.exitPages}
              />
            </div>
          </div>
        </Section>
        {/* Section: Results & Marketing */}
        <Section
          title="Resultaat & marketing"
          subtitle="Conversies en herkomst van bezoekers (optioneel: Search Console)."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-3">
              {mock.marketingKpis.map((k) => (
                <KpiCard key={k.id} kpi={k} />
              ))}
            </div>

            <div className="lg:col-span-2">
              <MiniBars
                title="Verkeersbronnen (aandeel)"
                items={mock.sources}
                unit="%"
              />
            </div>
          </div>
        </Section>
        {/* Map */}
        <Section
          title="Geografische spreiding"
          subtitle="Wereldkaart + top 5 landen met meeste bezoekers."
        >
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
              <div className="mt-4 h-[280px] rounded-xl border border-dashed border-white/15 bg-black/30">
                <div className="flex h-full items-center justify-center text-sm text-white/50">
                  Map placeholder (later echte kaart)
                </div>
              </div>
            </div>

            <ListCard title="Top 5 landen" items={mock.countries} />
          </div>
        </Section>

        <footer className="mt-16 border-t border-white/10 bg-black">
          <div className="mx-auto max-w-6xl px-6 py-12">
            {/* TOP ROW */}
            <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
              {/* Left: 3 contact columns */}
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
                <div className="space-y-1 text-s text-[hsl(85,0%,100%)]">
                  <div className="text-white">Vandaag bereikbaar</div>
                  <div>van 8u30 tot 17u00</div>
                </div>

                <div className="space-y-1 text-s text-[hsl(85,0%,100%)]">
                  <div className="text-white">+31 (0)45 20 518 56</div>
                  <div>info@pixelplus.nl</div>
                </div>

                <div className="space-y-1 text-s text-[hsl(85,0%,100%)]">
                  <div className="text-white">Raadhuisstraat 12</div>
                  <div>6191 KB Beek NL</div>
                </div>
              </div>

              {/* Right: Big logo */}
              <div className="flex justify-start md:justify-end">
                <Image
                  src="/brand/pixelplus+Logo.png"
                  alt="Pixelplus"
                  width={260}
                  height={60}
                  className="h-12 w-auto object-contain opacity-95"
                  priority
                />
              </div>
            </div>

            {/* SPACER */}
            <div className="my-10 h-px w-full" />

            {/* BOTTOM ROW (one line) */}
            <div className="flex items-center justify-between gap-10 overflow-x-auto whitespace-nowrap py-2 text-sm text-white/70">
              {/* Left group: legal + numbers */}
              <div className="flex items-center gap-8">
                <a href="#" className="hover:text-white">
                  Privacy
                </a>
                <a href="#" className="hover:text-white">
                  Cookies
                </a>
                <a href="#" className="hover:text-white">
                  Voorwaarden
                </a>

                <span>KvK: 5138 4175</span>
                <span>BTW: NL8232 55669 B01</span>
              </div>

              {/* Socials */}
              <div className="flex items-center gap-5">
                <a href="#" className="opacity-80 hover:opacity-100">
                  <Linkedin className="h-5 w-5" />
                </a>
                <a href="#" className="opacity-80 hover:opacity-100">
                  <Instagram className="h-5 w-5" />
                </a>
              </div>

              {/* Partners */}
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition">
                  <span>Google Partner</span>
                </div>

                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition">
                  <span>Leadinfo</span>
                </div>

                <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition">
                  <span>TAGGRS</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
