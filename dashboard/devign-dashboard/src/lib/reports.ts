import { supabaseAdmin } from "./supabaseAdmin";

export type MonthlyReportRow = {
  customer_id: string;
  month: string; // YYYY-MM-01
  summary: any;
  comparison: any;
  generated_at: string;
};

export async function getCustomer(customerId: string) {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("customers")
    .select("id, name, gsc_site_url")
    .eq("id", customerId)
    .single();

  if (error) throw new Error(`Customer fetch failed: ${error.message}`);
  return data;
}

export async function listMonths(customerId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("monthly_reports")
    .select("month")
    .eq("customer_id", customerId)
    .order("month", { ascending: false });

  if (error) throw new Error(`Months fetch failed: ${error.message}`);
  return (data ?? []).map((r) => r.month as string);
}

export async function getMonthlyReport(customerId: string, month?: string) {
  const sb = supabaseAdmin();

  let q = sb
    .from("monthly_reports")
    .select("customer_id, month, summary, comparison, generated_at")
    .eq("customer_id", customerId);

  if (month) q = q.eq("month", month);
  else q = q.order("month", { ascending: false }).limit(1);

  const { data, error } = month ? await q.single() : await q.maybeSingle();
  if (error) throw new Error(`Monthly report fetch failed: ${error.message}`);
  return data as MonthlyReportRow | null;
}

export async function getDailySeries(
  customerId: string,
  monthStart: string,
  monthEndExclusive: string,
) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ga4_daily_metrics")
    .select("date, active_users, new_users, sessions, pageviews")
    .eq("customer_id", customerId)
    .gte("date", monthStart)
    .lt("date", monthEndExclusive)
    .order("date", { ascending: true });

  if (error) throw new Error(`Daily series fetch failed: ${error.message}`);
  return data ?? [];
}
