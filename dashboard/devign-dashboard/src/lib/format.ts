export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return null; // => "Nog niet beschikbaar"
  return new Intl.NumberFormat("nl-BE").format(n);
}

export function formatPercent01(x: number | null | undefined) {
  // expects 0..1
  if (x === null || x === undefined) return null;
  return `${(x * 100).toFixed(1)}%`;
}

export function formatSecondsToMMSS(sec: number | null | undefined) {
  if (sec === null || sec === undefined) return null;
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

export function monthLabel(monthISO: string) {
  // monthISO = "2026-02-01"
  const d = new Date(`${monthISO}T00:00:00Z`);
  return d.toLocaleDateString("nl-BE", { month: "long", year: "numeric" });
}

export function monthRange(monthISO: string) {
  const start = new Date(`${monthISO}T00:00:00Z`);
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  return {
    start: start.toISOString().slice(0, 10),
    endExclusive: end.toISOString().slice(0, 10),
  };
}

export type Trend = "up" | "flat" | "down";
export function trendFromDelta(delta: number | null | undefined): Trend {
  if (delta === null || delta === undefined) return "flat";
  if (delta > 2) return "up";
  if (delta < -2) return "down";
  return "flat";
}
