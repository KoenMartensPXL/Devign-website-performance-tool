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
  // input: "2026-02-01"
  const d = new Date(`${yyyyMm01}T00:00:00Z`);
  const months = [
    "januari","februari","maart","april","mei","juni",
    "juli","augustus","september","oktober","november","december"
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Email-safe HTML: veel clients strippen <style>.
// Daarom zoveel mogelijk inline styles gebruiken.
function buildMonthlyEmailHtml({
  customerName,
  monthStr, // "2026-02-01"
  reportUrl,
  summary,
  comparison,
}) {
  const monthLabel = formatMonthNL(monthStr);

  // KPI helpers (toon altijd 0)
  const k = summary?.kpis ?? {};
  const topPages = summary?.top_pages ?? [];
  const topCountries = summary?.top_countries ?? [];

  const newUsers = Number(k.new_users ?? 0);
  const sessions = Number(k.sessions ?? 0);

  const topPage = topPages[0]?.key ?? "—";
  const topPageViews = Number(topPages[0]?.value ?? 0);

  const topCountry = topCountries[0]?.key ?? "—";
  const topCountryUsers = Number(topCountries[0]?.value ?? 0);

  // Groei (als beschikbaar)
  const comp = comparison?.kpis ?? {};
  const growthUsers = comp?.new_users?.delta_pct;
  const growthSessions = comp?.sessions?.delta_pct;

  const growthUsersLabel =
    typeof growthUsers === "number" ? `${growthUsers >= 0 ? "+" : ""}${growthUsers.toFixed(1)}%` : "—";
  const growthSessionsLabel =
    typeof growthSessions === "number" ? `${growthSessions >= 0 ? "+" : ""}${growthSessions.toFixed(1)}%` : "—";

  const year = new Date().getUTCFullYear();

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

      <!-- Header -->
      <div style="margin-bottom:22px;">
        <div style="font-size:22px;font-weight:700;letter-spacing:.5px;">pixelplus<span style="opacity:.65;">+</span></div>
        <h1 style="font-size:18px;margin:16px 0 10px;line-height:1.3;">Uw maandelijkse website rapport</h1>
        <p style="margin:0 0 10px;color:#cfcfcf;font-size:14px;line-height:1.6;">
          <b style="color:#fff;">Beste ${escapeHtml(customerName)},</b><br/>
          Hierbij ontvangt u het prestatierapport van uw website voor <strong>${escapeHtml(monthLabel)}</strong>.
          Hieronder ziet u een korte samenvatting van de belangrijkste cijfers.
        </p>
      </div>

      <!-- Stats: 2x2 grid (email-safe met table) -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;border-spacing:10px;margin:10px -10px 0;">
        <tr>
          <td width="50%" style="background:#1a1818;border-radius:10px;padding:18px;vertical-align:top;">
            <div style="font-size:13px;color:#fff;margin-bottom:10px;">👤 Nieuwe gebruikers</div>
            <div style="font-size:22px;font-weight:700;">${newUsers}</div>
            <div style="font-size:12px;color:#7CFFB2;margin-top:6px;">${escapeHtml(growthUsersLabel)} vs vorige maand</div>
          </td>
          <td width="50%" style="background:#1a1818;border-radius:10px;padding:18px;vertical-align:top;">
            <div style="font-size:13px;color:#fff;margin-bottom:10px;">📄 Sessies</div>
            <div style="font-size:22px;font-weight:700;">${sessions}</div>
            <div style="font-size:12px;color:#7CFFB2;margin-top:6px;">${escapeHtml(growthSessionsLabel)} vs vorige maand</div>
          </td>
        </tr>
        <tr>
          <td width="50%" style="background:#1a1818;border-radius:10px;padding:18px;vertical-align:top;">
            <div style="font-size:13px;color:#fff;margin-bottom:10px;">📑 Populairste pagina</div>
            <div style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(topPage)}</div>
            <div style="font-size:12px;color:#cfcfcf;margin-top:6px;">${topPageViews} weergaven</div>
          </td>
          <td width="50%" style="background:#1a1818;border-radius:10px;padding:18px;vertical-align:top;">
            <div style="font-size:13px;color:#fff;margin-bottom:10px;">🌍 Top land</div>
            <div style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(topCountry)}</div>
            <div style="font-size:12px;color:#cfcfcf;margin-top:6px;">${topCountryUsers} gebruikers</div>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="background:#1a1818;border-radius:10px;padding:22px;margin-top:16px;text-align:center;">
        <p style="margin:0 0 12px;color:#cfcfcf;font-size:13px;line-height:1.6;">
          Bekijk uw volledig dashboard met gedetailleerde statistieken, grafieken en groeikansen via onderstaande knop.
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

      <!-- Footer -->
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
  const html = buildMonthlyEmailHtml({ customerName, monthStr, reportUrl, summary, comparison });

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
