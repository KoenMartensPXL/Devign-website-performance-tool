/**
 * Daily GA4 fetch -> Supabase Postgres
 *
 * Requirements:
 * - customers table contains: id (uuid), name, ga4_property_id (text)
 * - ga4_daily_metrics + ga4_daily_breakdowns tables exist with unique(customer_id, date)
 *
 * Env:
 * - DATABASE_URL
 * - GA_SERVICE_ACCOUNT_JSON  (single-line JSON)
 *   OR GA_SERVICE_ACCOUNT_JSON_B64 (base64 encoded JSON)
 * - TARGET_DATE (optional YYYY-MM-DD). If omitted, script fetches yesterday (UTC).
 */

require("dotenv").config();
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const { Client } = require("pg");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getServiceAccountCredentials() {
  if (process.env.GA_SERVICE_ACCOUNT_JSON_B64) {
    const raw = Buffer.from(process.env.GA_SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf8");
    return JSON.parse(raw);
  }
  return JSON.parse(mustEnv("GA_SERVICE_ACCOUNT_JSON"));
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

async function main() {
  const targetDate = process.env.TARGET_DATE || toISODate(yesterdayUTC());

  const credentials = getServiceAccountCredentials();
  const ga = new BetaAnalyticsDataClient({ credentials });

  const db = new Client({ connectionString: mustEnv("DATABASE_URL") });
  await db.connect();

  // Optional: log job start (if you created job_runs table)
  let jobRunId = null;
  try {
    const jr = await db.query(
      `insert into public.job_runs (job_name, status, target_date)
       values ('ga4_daily_fetch', 'running', $1)
       returning id`,
      [targetDate]
    );
    jobRunId = jr.rows[0]?.id ?? null;
  } catch (_) {
    // ignore if table not present
  }

  const customersRes = await db.query(
    `select id, name, ga4_property_id
     from public.customers
     where is_active is true
     order by name asc`
  );
  const customers = customersRes.rows;

  console.log(`GA4 Daily Fetch: customers=${customers.length}, date=${targetDate}`);

  let ok = 0;
  let fail = 0;

  for (const c of customers) {
    const property = `properties/${c.ga4_property_id}`;

    try {
      // 1) Totals
      const [totalsResp] = await ga.runReport({
        property,
        dateRanges: [{ startDate: targetDate, endDate: targetDate }],
        metrics: [
          { name: "newUsers" },
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" }
        ]
      });

      const totalsRow = totalsResp.rows?.[0];
      const totalsValues = totalsRow?.metricValues?.map((m) => m.value) ?? [];

      const totals = {
        new_users: Number(totalsValues[0] ?? 0),
        active_users: Number(totalsValues[1] ?? 0),
        sessions: Number(totalsValues[2] ?? 0),
        pageviews: Number(totalsValues[3] ?? 0)
      };

      // 2) Top breakdown helper
      async function topList(dimensionName, metricName, limit = 10) {
        const [resp] = await ga.runReport({
          property,
          dateRanges: [{ startDate: targetDate, endDate: targetDate }],
          dimensions: [{ name: dimensionName }],
          metrics: [{ name: metricName }],
          orderBys: [{ metric: { metricName }, desc: true }],
          limit
        });

        return (resp.rows ?? []).map((r) => ({
          key: r.dimensionValues?.[0]?.value ?? "(not set)",
          value: Number(r.metricValues?.[0]?.value ?? 0)
        }));
      }

      // Dimension names can vary by GA4 setup; these are common:
      // If any of these error, tell me the error message and I'll adjust.
      const top_pages = await topList("pagePath", "screenPageViews", 10);
      const top_countries = await topList("country", "activeUsers", 10);
      const top_sources = await topList("sessionSource", "sessions", 10);

      // 3) Upsert totals
      await db.query(
        `insert into public.ga4_daily_metrics
          (customer_id, date, new_users, active_users, sessions, pageviews, fetched_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (customer_id, date)
         do update set
           new_users = excluded.new_users,
           active_users = excluded.active_users,
           sessions = excluded.sessions,
           pageviews = excluded.pageviews,
           fetched_at = now()`,
        [c.id, targetDate, totals.new_users, totals.active_users, totals.sessions, totals.pageviews]
      );

      // 4) Upsert breakdowns
      await db.query(
        `insert into public.ga4_daily_breakdowns
          (customer_id, date, top_pages, top_countries, top_sources, fetched_at)
         values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
         on conflict (customer_id, date)
         do update set
           top_pages = excluded.top_pages,
           top_countries = excluded.top_countries,
           top_sources = excluded.top_sources,
           fetched_at = now()`,
        [c.id, targetDate, JSON.stringify(top_pages), JSON.stringify(top_countries), JSON.stringify(top_sources)]
      );

      ok++;
      console.log(`✅ ${c.name}: saved (${targetDate})`);
    } catch (e) {
      fail++;
      console.error(`❌ ${c.name}: ${e.message}`);
    }
  }

  // Optional: log job end
  try {
    if (jobRunId) {
      const status = fail === 0 ? "success" : ok > 0 ? "partial" : "failed";
      await db.query(
        `update public.job_runs
         set finished_at = now(),
             status = $1,
             customers_total = $2,
             customers_success = $3,
             customers_failed = $4
         where id = $5`,
        [status, customers.length, ok, fail, jobRunId]
      );
    }
  } catch (_) {}

  await db.end();
  console.log(`Done. success=${ok}, failed=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
