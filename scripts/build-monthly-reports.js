require("dotenv").config();
const { Client } = require("pg");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function firstDayOfMonth(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return d;
}
function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}

// Default = previous month (so on 1st you summarize last month)
function defaultTargetMonth() {
  const now = new Date();
  const thisMonth = firstDayOfMonth(now);
  return addMonths(thisMonth, -1);
}

function trendFromDelta(deltaPct) {
  if (deltaPct === null || deltaPct === undefined) return "flat";
  if (deltaPct > 2) return "up";
  if (deltaPct < -2) return "down";
  return "flat";
}

function deltaPct(current, previous) {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null; // avoid Infinity; you can decide another rule
  return ((current - previous) / previous) * 100;
}

async function main() {
  const targetMonthStr = process.env.TARGET_MONTH; // "YYYY-MM-01" recommended
  const targetMonth = targetMonthStr ? new Date(`${targetMonthStr}T00:00:00Z`) : defaultTargetMonth();

  const monthStart = firstDayOfMonth(targetMonth);
  const monthEnd = addMonths(monthStart, 1);
  const prevMonthStart = addMonths(monthStart, -1);
  const prevMonthEnd = monthStart;

  console.log(`Monthly build: month=${iso(monthStart)} -> ${iso(monthEnd)} (prev ${iso(prevMonthStart)} -> ${iso(prevMonthEnd)})`);

  const db = new Client({ connectionString: mustEnv("DATABASE_URL") });
  await db.connect();

  // job run log
  const jr = await db.query(
    `insert into public.job_runs (job_name, status, target_date)
     values ('monthly_build', 'running', $1) returning id`,
    [iso(monthStart)]
  );
  const jobRunId = jr.rows[0].id;

  const customersRes = await db.query(
    `select id, name
     from public.customers
     where is_active is true
     order by name asc`
  );
  const customers = customersRes.rows;

  let ok = 0;
  let fail = 0;
  let errorSummary = "";

  // Helper: aggregate top lists from ga4_daily_breakdowns JSON arrays
  async function aggregateJsonTopList(customerId, columnName, limit, startDate, endDate, keyField = "key", valueField = "value") {
    const q = `
      select
        x.key as key,
        sum(x.value)::bigint as value
      from public.ga4_daily_breakdowns b
      cross join lateral (
        select
          (elem->>$3)::text as key,
          (elem->>$4)::numeric as value
        from jsonb_array_elements(b.${columnName}) as elem
      ) x
      where b.customer_id = $1
        and b.date >= $2::date
        and b.date < $5::date
      group by x.key
      order by value desc
      limit ${limit};
    `;
    const res = await db.query(q, [customerId, iso(startDate), keyField, valueField, iso(endDate)]);
    return res.rows.map(r => ({ key: r.key, value: Number(r.value) }));
  }

  async function aggregateGscTopQueries(customerId, limit, startDate, endDate) {
    const q = `
      select
        x.query as key,
        sum(x.clicks)::bigint as clicks,
        sum(x.impressions)::bigint as impressions
      from public.gsc_daily_queries q
      cross join lateral (
        select
          (elem->>'query')::text as query,
          coalesce((elem->>'clicks')::numeric,0) as clicks,
          coalesce((elem->>'impressions')::numeric,0) as impressions
        from jsonb_array_elements(q.top_queries) as elem
      ) x
      where q.customer_id = $1
        and q.date >= $2::date
        and q.date < $3::date
      group by x.query
      order by clicks desc, impressions desc
      limit ${limit};
    `;
    const res = await db.query(q, [customerId, iso(startDate), iso(endDate)]);
    return res.rows.map(r => ({
      query: r.key,
      clicks: Number(r.clicks),
      impressions: Number(r.impressions),
    }));
  }

  for (const c of customers) {
    try {
      // --------------------------
      // GA4 monthly totals/avgs
      // --------------------------
      const ga4Agg = await db.query(
        `
        select
          coalesce(sum(new_users),0)::bigint as new_users_sum,
          coalesce(sum(active_users),0)::bigint as active_users_sum,
          coalesce(sum(sessions),0)::bigint as sessions_sum,
          coalesce(sum(pageviews),0)::bigint as pageviews_sum,
          avg(engagement_rate) as engagement_rate_avg,
          avg(bounce_rate) as bounce_rate_avg,
          avg(avg_engagement_time_seconds) as avg_engagement_time_seconds_avg,
          avg(pages_per_session) as pages_per_session_avg,
          coalesce(sum(conversions),0)::bigint as conversions_sum,
          coalesce(sum(total_revenue),0)::numeric as total_revenue_sum
        from public.ga4_daily_metrics
        where customer_id = $1
          and date >= $2::date
          and date < $3::date
        `,
        [c.id, iso(monthStart), iso(monthEnd)]
      );

      const g = ga4Agg.rows[0];

      // --------------------------
      // GA4 top lists (month)
      // --------------------------
      const top_pages = await aggregateJsonTopList(c.id, "top_pages", 5, monthStart, monthEnd);
      const top_countries = await aggregateJsonTopList(c.id, "top_countries", 5, monthStart, monthEnd);
      const top_sources = await aggregateJsonTopList(c.id, "top_sources", 5, monthStart, monthEnd);
      const top_events = await aggregateJsonTopList(c.id, "top_events", 5, monthStart, monthEnd);
      const device_split = await aggregateJsonTopList(c.id, "device_split", 3, monthStart, monthEnd);

      // --------------------------
      // GSC monthly totals/avgs
      // --------------------------
      const gscAgg = await db.query(
        `
        select
          coalesce(sum(clicks),0)::bigint as clicks_sum,
          coalesce(sum(impressions),0)::bigint as impressions_sum,
          avg(ctr) as ctr_avg,
          avg(avg_position) as position_avg
        from public.gsc_daily_metrics
        where customer_id = $1
          and date >= $2::date
          and date < $3::date
        `,
        [c.id, iso(monthStart), iso(monthEnd)]
      );

      const s = gscAgg.rows[0];
      const top_queries = await aggregateGscTopQueries(c.id, 5, monthStart, monthEnd);

      // --------------------------
      // Build summary JSON
      // --------------------------
      const summary = {
        month: iso(monthStart),
        range: { start: iso(monthStart), end_exclusive: iso(monthEnd) },
        kpis: {
          new_users: Number(g.new_users_sum),
          active_users: Number(g.active_users_sum),
          sessions: Number(g.sessions_sum),
          pageviews: Number(g.pageviews_sum),
          engagement_rate_avg: g.engagement_rate_avg !== null ? Number(g.engagement_rate_avg) : null,
          bounce_rate_avg: g.bounce_rate_avg !== null ? Number(g.bounce_rate_avg) : null,
          avg_engagement_time_seconds_avg:
            g.avg_engagement_time_seconds_avg !== null ? Number(g.avg_engagement_time_seconds_avg) : null,
          pages_per_session_avg: g.pages_per_session_avg !== null ? Number(g.pages_per_session_avg) : null,
          conversions: Number(g.conversions_sum),
          total_revenue: g.total_revenue_sum !== null ? Number(g.total_revenue_sum) : 0,
        },
        top_pages,
        top_countries,
        top_sources,
        top_events,
        device_split,
        gsc: {
          clicks: Number(s.clicks_sum),
          impressions: Number(s.impressions_sum),
          ctr_avg: s.ctr_avg !== null ? Number(s.ctr_avg) : null,
          position_avg: s.position_avg !== null ? Number(s.position_avg) : null,
        },
        top_queries,
      };

      // --------------------------
      // Build comparison JSON (vs previous month)
      // We'll compute prev month summary quickly from daily tables (same logic but no top lists needed for now)
      // --------------------------
      const ga4PrevAgg = await db.query(
        `
        select
          coalesce(sum(new_users),0)::bigint as new_users_sum,
          coalesce(sum(active_users),0)::bigint as active_users_sum,
          coalesce(sum(sessions),0)::bigint as sessions_sum,
          coalesce(sum(pageviews),0)::bigint as pageviews_sum,
          avg(engagement_rate) as engagement_rate_avg,
          avg(bounce_rate) as bounce_rate_avg,
          avg(avg_engagement_time_seconds) as avg_engagement_time_seconds_avg,
          avg(pages_per_session) as pages_per_session_avg,
          coalesce(sum(conversions),0)::bigint as conversions_sum
        from public.ga4_daily_metrics
        where customer_id = $1
          and date >= $2::date
          and date < $3::date
        `,
        [c.id, iso(prevMonthStart), iso(prevMonthEnd)]
      );
      const gp = ga4PrevAgg.rows[0];

      const gscPrevAgg = await db.query(
        `
        select
          coalesce(sum(clicks),0)::bigint as clicks_sum,
          coalesce(sum(impressions),0)::bigint as impressions_sum,
          avg(ctr) as ctr_avg,
          avg(avg_position) as position_avg
        from public.gsc_daily_metrics
        where customer_id = $1
          and date >= $2::date
          and date < $3::date
        `,
        [c.id, iso(prevMonthStart), iso(prevMonthEnd)]
      );
      const sp = gscPrevAgg.rows[0];

      function compEntry(key, curr, prev) {
        const d = deltaPct(curr, prev);
        return {
          key,
          current: curr,
          previous: prev,
          delta_pct: d,
          trend: trendFromDelta(d),
        };
      }

      const comparison = {
        month: iso(monthStart),
        vs_month: iso(prevMonthStart),
        kpis: {
          new_users: compEntry("new_users", summary.kpis.new_users, Number(gp.new_users_sum)),
          active_users: compEntry("active_users", summary.kpis.active_users, Number(gp.active_users_sum)),
          sessions: compEntry("sessions", summary.kpis.sessions, Number(gp.sessions_sum)),
          pageviews: compEntry("pageviews", summary.kpis.pageviews, Number(gp.pageviews_sum)),
          engagement_rate_avg: compEntry(
            "engagement_rate_avg",
            summary.kpis.engagement_rate_avg,
            gp.engagement_rate_avg !== null ? Number(gp.engagement_rate_avg) : null
          ),
          pages_per_session_avg: compEntry(
            "pages_per_session_avg",
            summary.kpis.pages_per_session_avg,
            gp.pages_per_session_avg !== null ? Number(gp.pages_per_session_avg) : null
          ),
          conversions: compEntry("conversions", summary.kpis.conversions, Number(gp.conversions_sum)),
          gsc_clicks: compEntry("gsc_clicks", summary.gsc.clicks, Number(sp.clicks_sum)),
          gsc_impressions: compEntry("gsc_impressions", summary.gsc.impressions, Number(sp.impressions_sum)),
        },
      };

      // --------------------------
      // Upsert monthly_reports
      // --------------------------
      await db.query(
        `
        insert into public.monthly_reports (customer_id, month, summary, comparison, generated_at)
        values ($1, $2::date, $3::jsonb, $4::jsonb, now())
        on conflict (customer_id, month) do update set
          summary = excluded.summary,
          comparison = excluded.comparison,
          generated_at = now()
        `,
        [c.id, iso(monthStart), JSON.stringify(summary), JSON.stringify(comparison)]
      );

      ok++;
      console.log(`✅ Monthly report saved: ${c.name} month=${iso(monthStart)}`);
    } catch (e) {
      fail++;
      const msg = `❌ Monthly report failed ${c.name}: ${e.message}`;
      console.error(msg);
      errorSummary += msg + "\n";
    }
  }

  const status = fail === 0 ? "success" : ok > 0 ? "partial" : "failed";
  await db.query(
    `update public.job_runs
     set finished_at = now(),
         status = $1,
         customers_total = $2,
         customers_success = $3,
         customers_failed = $4,
         error_summary = $5
     where id = $6`,
    [status, customers.length, ok, fail, errorSummary.slice(0, 4000), jobRunId]
  );

  await db.end();
  console.log(`Done. status=${status} ok=${ok} fail=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
