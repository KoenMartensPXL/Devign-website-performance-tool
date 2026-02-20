require("dotenv").config();
const { Client } = require("pg");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const { google } = require("googleapis");

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

// Wrap any awaited function so errors include a label + (optional) customer name.
async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const details = e && e.details ? ` | details=${JSON.stringify(e.details)}` : "";
    throw new Error(`[${label}] ${msg}${details}`);
  }
}

// Some GA4 metrics/dimensions vary by property/config. Provide fallbacks.
async function runReportWithFallback(label, ga, request, fallbacks = []) {
  // Try primary request
  try {
    return await safe(label, async () => ga.runReport(request));
  } catch (e) {
    // Only attempt fallbacks for INVALID_ARGUMENT (most common here)
    const msg = e.message || "";
    if (!msg.includes("INVALID_ARGUMENT") || fallbacks.length === 0) throw e;

    for (const fb of fallbacks) {
      try {
        return await safe(`${label} (fallback: ${fb.name})`, async () =>
          ga.runReport(fb.request(request))
        );
      } catch (e2) {
        // keep trying
      }
    }
    // If all fallbacks fail, throw the original error (or last)
    throw e;
  }
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
    const customerLabel = `${c.name} (${c.ga4_property_id})`;

    try {
      if (!c.ga4_property_id) {
        throw new Error(`[CONFIG] Missing ga4_property_id for customer`);
      }

      const property = `properties/${c.ga4_property_id}`;

      // -----------------------
      // GA4: totals (with fallbacks)
      // -----------------------
      // Safer baseline metrics; conversions & totalRevenue are optional (may be invalid for some props).
      const totalsRequest = {
        property,
        dateRanges: [{ startDate: targetDate, endDate: targetDate }],
        metrics: [
          { name: "newUsers" },
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "bounceRate" },
          // Engagement time metrics differ between setups; try averageEngagementTime, then averageSessionDuration, then userEngagementDuration.
          { name: "averageEngagementTime" },
          // Optional:
          { name: "conversions" },
          { name: "totalRevenue" },
        ],
      };

      // Fallbacks:
      // 1) Replace averageEngagementTime -> averageSessionDuration
      // 2) Replace averageEngagementTime -> userEngagementDuration
      // 3) Drop conversions & totalRevenue entirely
      const [totalsResp] = await runReportWithFallback(
        `GA4 totals for ${customerLabel}`,
        ga,
        totalsRequest,
        [
          {
            name: "avgEngagementTime -> averageSessionDuration",
            request: (req) => ({
              ...req,
              metrics: req.metrics.map((m) =>
                m.name === "averageEngagementTime" ? { name: "averageSessionDuration" } : m
              ),
            }),
          },
          {
            name: "avgEngagementTime -> userEngagementDuration",
            request: (req) => ({
              ...req,
              metrics: req.metrics.map((m) =>
                m.name === "averageEngagementTime" ? { name: "userEngagementDuration" } : m
              ),
            }),
          },
          {
            name: "drop conversions + totalRevenue",
            request: (req) => ({
              ...req,
              metrics: req.metrics.filter(
                (m) => m.name !== "conversions" && m.name !== "totalRevenue"
              ),
            }),
          },
        ]
      );

      const row = totalsResp.rows?.[0];
      const mv = row?.metricValues?.map((m) => m.value) ?? [];

      // Map values safely by looking up metric order from the response metadata when possible
      // (but the client doesn't always return metadata in an easy way), so we assume request order after fallback.
      // We'll detect which metrics were returned based on length.
      const new_users = Number(mv[0] ?? 0);
      const active_users = Number(mv[1] ?? 0);
      const sessions = Number(mv[2] ?? 0);
      const pageviews = Number(mv[3] ?? 0);
      const engagement_rate = mv[4] != null ? Number(mv[4]) : null;
      const bounce_rate = mv[5] != null ? Number(mv[5]) : null;

      // avg time is mv[6] if present
      const avg_engagement_time_seconds =
        mv[6] != null ? Math.round(Number(mv[6])) : null;

      // Optional fields may or may not be present depending on fallback
      const conversions = mv.length >= 8 && mv[7] != null ? Number(mv[7]) : null;
      const total_revenue = mv.length >= 9 && mv[8] != null ? Number(mv[8]) : null;

      const pagesPerSession = sessions > 0 ? pageviews / sessions : null;

      await safe(`DB upsert ga4_daily_metrics for ${customerLabel}`, async () =>
        db.query(
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
            new_users,
            active_users,
            sessions,
            pageviews,
            engagement_rate,
            bounce_rate,
            avg_engagement_time_seconds,
            pagesPerSession,
            conversions,
            total_revenue,
          ]
        )
      );

      // -----------------------
      // GA4: breakdown helper with dimension fallbacks
      // -----------------------
      async function topList(label, dimensionName, metricName, limit = 5, dimensionFallbacks = []) {
        const request = {
          property,
          dateRanges: [{ startDate: targetDate, endDate: targetDate }],
          dimensions: [{ name: dimensionName }],
          metrics: [{ name: metricName }],
          orderBys: [{ metric: { metricName }, desc: true }],
          limit,
        };

        // Build fallback requests (dimension substitutions)
        const fb = (dimensionFallbacks || []).map((d) => ({
          name: `dimension ${dimensionName} -> ${d}`,
          request: (req) => ({
            ...req,
            dimensions: [{ name: d }],
          }),
        }));

        const [resp] = await runReportWithFallback(
          `${label} for ${customerLabel}`,
          ga,
          request,
          fb
        );

        return (resp.rows ?? []).map((r) => ({
          key: r.dimensionValues?.[0]?.value ?? "(not set)",
          value: Number(r.metricValues?.[0]?.value ?? 0),
        }));
      }

      // Page path dimension frequently differs; try safe fallbacks
      const top_pages = await topList(
        "GA4 top_pages (page path)",
        "pagePath",
        "screenPageViews",
        5,
        ["pagePathPlusQueryString", "unifiedPagePathScreen", "pageTitle"]
      );

      const top_countries = await topList(
        "GA4 top_countries",
        "country",
        "activeUsers",
        5
      );

      const top_sources = await topList(
        "GA4 top_sources",
        "sessionSource",
        "sessions",
        5,
        ["sessionSourceMedium", "firstUserSourceMedium", "firstUserSource"]
      );

      const top_events = await topList(
        "GA4 top_events",
        "eventName",
        "eventCount",
        5
      );

      const device_split = await topList(
        "GA4 device_split",
        "deviceCategory",
        "sessions",
        3
      );

      await safe(`DB upsert ga4_daily_breakdowns for ${customerLabel}`, async () =>
        db.query(
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
        )
      );

      // -----------------------
      // GSC (optional): totals + top queries (with labels)
      // -----------------------
      if (c.gsc_site_url) {
        const siteUrl = c.gsc_site_url;

        const gscTopResp = await safe(`GSC top queries for ${customerLabel}`, async () =>
          gsc.searchanalytics.query({
            siteUrl,
            requestBody: {
              startDate: targetDate,
              endDate: targetDate,
              dimensions: ["query"],
              rowLimit: 5,
            },
          })
        );

        const rows = gscTopResp.data.rows ?? [];

        const totalsResp = await safe(`GSC totals for ${customerLabel}`, async () =>
          gsc.searchanalytics.query({
            siteUrl,
            requestBody: {
              startDate: targetDate,
              endDate: targetDate,
              rowLimit: 1,
            },
          })
        );

        const totalRow = totalsResp.data.rows?.[0];

        const clicks = totalRow?.clicks ?? 0;
        const impressions = totalRow?.impressions ?? 0;
        const ctr = totalRow?.ctr ?? (impressions > 0 ? clicks / impressions : null);
        const position = totalRow?.position ?? null;

        await safe(`DB upsert gsc_daily_metrics for ${customerLabel}`, async () =>
          db.query(
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
          )
        );

        const top_queries = rows.map((r) => ({
          query: r.keys?.[0] ?? "(not set)",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? null,
          position: r.position ?? null,
        }));

        await safe(`DB upsert gsc_daily_queries for ${customerLabel}`, async () =>
          db.query(
            `insert into public.gsc_daily_queries
              (customer_id, date, top_queries, fetched_at)
             values ($1,$2,$3::jsonb, now())
             on conflict (customer_id, date) do update set
               top_queries = excluded.top_queries,
               fetched_at = now()`,
            [c.id, targetDate, JSON.stringify(top_queries)]
          )
        );
      } else {
        console.log(`ℹ️  ${c.name}: no gsc_site_url set, skipping GSC`);
      }

      ok++;
      console.log(`✅ DONE ${c.name} (${targetDate})`);
    } catch (e) {
      fail++;
      const msg = `❌ FAIL ${c.name}: ${e.message}`;
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
