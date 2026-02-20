require("dotenv").config();
const { Client } = require("pg");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const { google } = require("googleapis");
const crypto = require("crypto");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function getServiceAccount() {
  if (process.env.GA_SERVICE_ACCOUNT_JSON_B64) {
    const raw = Buffer.from(process.env.GA_SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf8");
    return JSON.parse(raw);
  }
  return JSON.parse(mustEnv("GA_SERVICE_ACCOUNT_JSON"));
}

async function main() {
  const targetDate = process.env.TARGET_DATE || toISODate(yesterdayUTC());

  const sa = getServiceAccount();

  // DB
  const db = new Client({ connectionString: mustEnv("DATABASE_URL") });
  await db.connect();

  // Job run log
  const jr = await db.query(
    `insert into public.job_runs (job_name, status, target_date)
     values ('daily_fetch', 'running', $1) returning id`,
    [targetDate]
  );
  const jobRunId = jr.rows[0].id;

  // Fetch customers (need ga4_property_id, and optionally gsc_site_url)
  const customersRes = await db.query(
    `select id, name, ga4_property_id, gsc_site_url
     from public.customers
     where is_active is true
     order by name asc`
  );
  const customers = customersRes.rows;

  // GA4 client
  const ga = new BetaAnalyticsDataClient({ credentials: sa });

  // GSC client (JWT auth)
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const gsc = google.searchconsole({ version: "v1", auth: jwt });

  let ok = 0;
  let fail = 0;
  let errorSummary = "";

  console.log(`Daily fetch date=${targetDate}, customers=${customers.length}`);

  for (const c of customers) {
    try {
      // -----------------------
      // GA4: totals
      // -----------------------
      const property = `properties/${c.ga4_property_id}`;

      const [totalsResp] = await ga.runReport({
        property,
        dateRanges: [{ startDate: targetDate, endDate: targetDate }],
        metrics: [
          { name: "newUsers" },
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "bounceRate" },
          { name: "averageEngagementTime" }, // seconds
          { name: "conversions" },
          { name: "totalRevenue" },
        ],
      });

      const row = totalsResp.rows?.[0];
      const mv = row?.metricValues?.map((m) => m.value) ?? [];

      const ga4Totals = {
        new_users: Number(mv[0] ?? 0),
        active_users: Number(mv[1] ?? 0),
        sessions: Number(mv[2] ?? 0),
        pageviews: Number(mv[3] ?? 0),
        engagement_rate: mv[4] != null ? Number(mv[4]) : null,
        bounce_rate: mv[5] != null ? Number(mv[5]) : null,
        avg_engagement_time_seconds: mv[6] != null ? Math.round(Number(mv[6])) : null,
        conversions: mv[7] != null ? Number(mv[7]) : null,
        total_revenue: mv[8] != null ? Number(mv[8]) : null,
      };

      const pagesPerSession =
        ga4Totals.sessions > 0 ? ga4Totals.pageviews / ga4Totals.sessions : null;

      // Upsert GA4 daily metrics
      await db.query(
        `insert into public.ga4_daily_metrics
          (customer_id, date, new_users, active_users, sessions, pageviews,
           engagement_rate, bounce_rate, avg_engagement_time_seconds, pages_per_session,
           conversions, total_revenue, fetched_at)
         values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
         on conflict (customer_id, date) do update set
           new_users = excluded.new_users,
           active_users = excluded.active_users,
           sessions = excluded.sessions,
           pageviews = excluded.pageviews,
           engagement_rate = excluded.engagement_rate,
           bounce_rate = excluded.bounce_rate,
           avg_engagement_time_seconds = excluded.avg_engagement_time_seconds,
           pages_per_session = excluded.pages_per_session,
           conversions = excluded.conversions,
           total_revenue = excluded.total_revenue,
           fetched_at = now()`,
        [
          c.id,
          targetDate,
          ga4Totals.new_users,
          ga4Totals.active_users,
          ga4Totals.sessions,
          ga4Totals.pageviews,
          ga4Totals.engagement_rate,
          ga4Totals.bounce_rate,
          ga4Totals.avg_engagement_time_seconds,
          pagesPerSession,
          ga4Totals.conversions,
          ga4Totals.total_revenue,
        ]
      );

      // -----------------------
      // GA4: breakdown helper
      // -----------------------
      async function topList(dimensionName, metricName, limit = 5) {
        const [resp] = await ga.runReport({
          property,
          dateRanges: [{ startDate: targetDate, endDate: targetDate }],
          dimensions: [{ name: dimensionName }],
          metrics: [{ name: metricName }],
          orderBys: [{ metric: { metricName }, desc: true }],
          limit,
        });

        return (resp.rows ?? []).map((r) => ({
          key: r.dimensionValues?.[0]?.value ?? "(not set)",
          value: Number(r.metricValues?.[0]?.value ?? 0),
        }));
      }

      const top_pages = await topList("pagePath", "screenPageViews", 5);
      const top_countries = await topList("country", "activeUsers", 5);
      const top_sources = await topList("sessionSource", "sessions", 5);
      const top_events = await topList("eventName", "eventCount", 5);
      const device_split = await topList("deviceCategory", "sessions", 3);

      await db.query(
        `insert into public.ga4_daily_breakdowns
          (customer_id, date, top_pages, top_countries, top_sources, top_events, device_split, fetched_at)
         values
          ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb, now())
         on conflict (customer_id, date) do update set
           top_pages = excluded.top_pages,
           top_countries = excluded.top_countries,
           top_sources = excluded.top_sources,
           top_events = excluded.top_events,
           device_split = excluded.device_split,
           fetched_at = now()`,
        [
          c.id,
          targetDate,
          JSON.stringify(top_pages),
          JSON.stringify(top_countries),
          JSON.stringify(top_sources),
          JSON.stringify(top_events),
          JSON.stringify(device_split),
        ]
      );

      // -----------------------
      // GSC (optional): totals + top queries
      // Requires customers.gsc_site_url and access granted to service account in GSC
      // -----------------------
      if (c.gsc_site_url) {
        const siteUrl = c.gsc_site_url; // e.g. "https://techstart.nl/"
        const gscResp = await gsc.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: targetDate,
            endDate: targetDate,
            dimensions: ["query"],
            rowLimit: 5,
          },
        });

        const rows = gscResp.data.rows ?? [];
        const totals = rows.reduce(
          (acc, r) => {
            acc.clicks += r.clicks ?? 0;
            acc.impressions += r.impressions ?? 0;
            return acc;
          },
          { clicks: 0, impressions: 0 }
        );

        // For CTR/position: GSC can give totals if you query without dimensions too.
        const totalsResp = await gsc.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: targetDate,
            endDate: targetDate,
            rowLimit: 1,
          },
        });

        const totalRow = totalsResp.data.rows?.[0];
        const clicks = totalRow?.clicks ?? totals.clicks ?? 0;
        const impressions = totalRow?.impressions ?? totals.impressions ?? 0;
        const ctr = totalRow?.ctr ?? (impressions > 0 ? clicks / impressions : null);
        const position = totalRow?.position ?? null;

        await db.query(
          `insert into public.gsc_daily_metrics
            (customer_id, date, clicks, impressions, ctr, avg_position, fetched_at)
           values ($1,$2,$3,$4,$5,$6, now())
           on conflict (customer_id, date) do update set
             clicks = excluded.clicks,
             impressions = excluded.impressions,
             ctr = excluded.ctr,
             avg_position = excluded.avg_position,
             fetched_at = now()`,
          [c.id, targetDate, clicks, impressions, ctr, position]
        );

        const top_queries = rows.map((r) => ({
          query: r.keys?.[0] ?? "(not set)",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? null,
          position: r.position ?? null,
        }));

        await db.query(
          `insert into public.gsc_daily_queries
            (customer_id, date, top_queries, fetched_at)
           values ($1,$2,$3::jsonb, now())
           on conflict (customer_id, date) do update set
             top_queries = excluded.top_queries,
             fetched_at = now()`,
          [c.id, targetDate, JSON.stringify(top_queries)]
        );
      }

      ok++;
      console.log(`✅ ${c.name} (${targetDate})`);
    } catch (e) {
      fail++;
      const msg = `❌ ${c.name}: ${e.message}`;
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
