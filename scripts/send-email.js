// scripts/send-email.js
const { Resend } = require("resend");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMonthNL(yyyyMm01) {
  const d = new Date(`${yyyyMm01}T00:00:00Z`);
  const months = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtInt(n) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0";
  return Math.round(x).toLocaleString("nl-NL");
}

function fmtPct(delta) {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "—";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function deltaColor(delta) {
  // matches your design: green for up, red for down, gray for neutral/unknown
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "#9a9a9a";
  if (delta > 1.5) return "#7CFFB2";
  if (delta < -1.5) return "#FF6B6B";
  return "#cfcfcf";
}

function buildMonthlyEmailHtml({
  customerName,
  monthStr, // "YYYY-MM-01"
  reportUrl,
  summary,
  comparison,
}) {
  const monthLabel = formatMonthNL(monthStr);

  const k = summary?.kpis ?? {};
  const gsc = summary?.gsc ?? {};
  const comp = comparison?.kpis ?? {};

  // KPI 1: Nieuwe gebruikers (GA4)
  const newUsers = Number(k.new_users ?? 0);
  const newUsersDelta = comp?.new_users?.delta_pct;

  // KPI 2: Conversies (GA4)
  const conversions = Number(k.conversions ?? 0);
  const conversionsDelta = comp?.conversions?.delta_pct;

  // KPI 3: Organisch verkeer (GSC clicks)
  const organicClicks = Number(gsc.clicks ?? 0);
  const organicClicksDelta = comp?.gsc_clicks?.delta_pct;

  // KPI 4: Gemiste kans (GSC impressions - clicks)
  const impressions = Number(gsc.impressions ?? 0);
  const missedOpportunity = Math.max(0, impressions - organicClicks);

  const prevClicks = Number(comp?.gsc_clicks?.previous ?? 0);
  const prevImpressions = Number(comp?.gsc_impressions?.previous ?? 0);
  const prevMissed = Math.max(0, prevImpressions - prevClicks);

  const missedDelta =
    prevMissed === 0 ? (missedOpportunity === 0 ? 0 : null) : ((missedOpportunity - prevMissed) / prevMissed) * 100;

  const year = new Date().getUTCFullYear();

  const hook =
    missedOpportunity > 0
      ? `We zien <b style="color:#fff;">${fmtInt(
          missedOpportunity
        )}</b> Google-vertoningen zonder klik — er zit dus nog extra groei in.`
      : `Netjes: vrijwel alle vertoningen pakken ook écht clicks. Tijd om te kijken waar we nog kunnen optimaliseren.`;

  const cardStyle =
    "background:#1a1818;border-radius:10px;padding:18px;vertical-align:top;";
  const labelStyle = "font-size:13px;color:#fff;margin-bottom:10px;";
  const valueStyle = "font-size:22px;font-weight:700;";
  const subStyle = "font-size:12px;margin-top:6px;";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Website Rapport</title>
</head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;">
  <div style="padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#0f0e0e;border-radius:12px;padding:28px;border:1px solid rgba(255,255,255,.08);">

      <div style="margin-bottom:22px;">
        <div style="font-size:22px;font-weight:700;letter-spacing:.5px;">pixelplus<span style="opacity:.65;">+</span></div>
        <h1 style="font-size:18px;margin:16px 0 10px;line-height:1.3;">Uw maandelijkse website rapport</h1>
        <p style="margin:0 0 10px;color:#cfcfcf;font-size:14px;line-height:1.6;">
          <b style="color:#fff;">Beste ${escapeHtml(customerName)},</b><br/>
          Hierbij ontvangt u het prestatierapport van uw website voor <strong>${escapeHtml(
            monthLabel
          )}</strong>.
          Hieronder ziet u de 4 KPI’s die er deze maand écht toe doen.
        </p>

        <div style="margin-top:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:12px 14px;border-radius:10px;color:#cfcfcf;font-size:13px;line-height:1.6;">
          ✨ ${hook}
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;border-spacing:10px;margin:10px -10px 0;">
        <tr>
          <td width="50%" style="${cardStyle}">
            <div style="${labelStyle}">Nieuwe gebruikers</div>
            <div style="${valueStyle}">${fmtInt(newUsers)}</div>
            <div style="${subStyle}color:${deltaColor(newUsersDelta)};">
              ${escapeHtml(fmtPct(newUsersDelta))} vs vorige maand
            </div>
          </td>

          <td width="50%" style="${cardStyle}">
            <div style="${labelStyle}">Conversies</div>
            <div style="${valueStyle}">${fmtInt(conversions)}</div>
            <div style="${subStyle}color:${deltaColor(conversionsDelta)};">
              ${escapeHtml(fmtPct(conversionsDelta))} vs vorige maand
            </div>
          </td>
        </tr>

        <tr>
          <td width="50%" style="${cardStyle}">
            <div style="${labelStyle}">Organisch verkeer</div>
            <div style="${valueStyle}">${fmtInt(organicClicks)}</div>
            <div style="font-size:12px;color:#cfcfcf;margin-top:6px;">
              Google clicks (Search Console)
            </div>
            <div style="${subStyle}color:${deltaColor(organicClicksDelta)};">
              ${escapeHtml(fmtPct(organicClicksDelta))} vs vorige maand
            </div>
          </td>

          <td width="50%" style="${cardStyle}">
            <div style="${labelStyle}">Gemiste kans</div>
            <div style="${valueStyle}">${fmtInt(missedOpportunity)}</div>
            <div style="font-size:12px;color:#cfcfcf;margin-top:6px;">
              Vertoningen zónder klik (impressies − clicks)
            </div>
            <div style="${subStyle}color:${deltaColor(missedDelta)};">
              ${escapeHtml(fmtPct(missedDelta))} vs vorige maand
            </div>
          </td>
        </tr>
      </table>

      <div style="background:#1a1818;border-radius:10px;padding:22px;margin-top:16px;text-align:center;">
        <p style="margin:0 0 12px;color:#cfcfcf;font-size:13px;line-height:1.6;">
          In uw dashboard ziet u precies <b style="color:#fff;">waar</b> de groei zit (pagina’s, zoekwoorden, trends) en welke acties het meeste opleveren.
        </p>
        <a href="${escapeHtml(reportUrl)}"
           style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:700;
                  padding:12px 18px;border-radius:8px;font-size:14px;">
          Bekijk mijn rapport
        </a>
        <div style="margin-top:10px;font-size:11px;color:#9a9a9a;">
          Deze link is tijdelijk geldig.
        </div>
      </div>

      <p style="margin:18px 0 0;color:#cfcfcf;font-size:13px;line-height:1.6;">
        Heeft u vragen over uw cijfers? Of wilt u meer uit uw website halen? Reageer op deze e-mail of neem contact met ons op.
      </p>
      <p style="margin:12px 0 0;color:#cfcfcf;font-size:13px;line-height:1.6;">
        Met vriendelijke groet,<br><strong style="color:#fff;">Team Pixelplus</strong>
      </p>

      <div style="margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);text-align:center;">
        <div style="font-size:12px;color:#8a8a8a;line-height:1.6;">
          <strong style="color:#fff;">Pixelplus Web Development</strong><br/>
          info@pixelplus.nl | +31 (0)45 20 518 56
        </div>
        <div style="margin-top:10px;font-size:11px;color:#6b6b6b;line-height:1.6;">
          Deze e-mail is automatisch gegenereerd op basis van uw data. Data wordt dagelijks om 00:30 bijgewerkt via GA4/GSC.<br/>
          &copy; ${year} Pixelplus. Alle rechten voorbehouden.
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}

async function sendMonthlyTestEmail({
  to,
  customerName,
  monthStr,
  reportUrl,
  summary,
  comparison,
}) {
  const resend = new Resend(mustEnv("RESEND_API_KEY"));

  const subject = `Pixelplus rapport – ${formatMonthNL(monthStr)} – ${customerName}`;
  const html = buildMonthlyEmailHtml({
    customerName,
    monthStr,
    reportUrl,
    summary,
    comparison,
  });

  return resend.emails.send({
    from: "Pixelplus <onboarding@resend.dev>",
    to: [to],
    subject,
    html,
    text: `Rapport ${formatMonthNL(monthStr)} voor ${customerName}: ${reportUrl}`,
  });
}

module.exports = {
  sendMonthlyTestEmail,
};
