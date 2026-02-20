"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(monthISO: string) {
  // monthISO = "2026-02-01"
  const start = new Date(`${monthISO}T00:00:00Z`);
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  const out: string[] = [];
  for (let dt = new Date(start); dt < end; dt.setUTCDate(dt.getUTCDate() + 1)) {
    out.push(iso(dt));
  }
  return out;
}

function shortLabel(dateISO: string) {
  // "2026-02-19" -> "19"
  return dateISO.slice(8, 10);
}

export default function UsersOverTimeChart({
  monthISO,
  series,
  metric = "active_users",
}: {
  monthISO: string;
  series: Array<{
    date: string;
    active_users?: number;
    new_users?: number;
    sessions?: number;
    pageviews?: number;
  }>;
  metric?: "active_users" | "new_users" | "sessions" | "pageviews";
}) {
  // Maak map van bestaande dagen -> value
  const map = new Map<string, number>();
  for (const r of series || []) {
    const v = Number((r as any)[metric] ?? 0);
    map.set(r.date, Number.isFinite(v) ? v : 0);
  }

  // Vul ALLE dagen van de maand (zodat chart altijd zichtbaar is)
  const full = daysInMonth(monthISO).map((d) => ({
    date: d,
    value: map.get(d) ?? 0,
    label: shortLabel(d),
  }));

  return (
    <div className="mt-4 h-[220px] rounded-xl border border-white/10 bg-black/20 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={full}
          margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            interval="preserveStartEnd"
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(0,0,0,0.9)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "white",
              fontSize: 12,
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
            formatter={(v: any) => [v, metric]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
