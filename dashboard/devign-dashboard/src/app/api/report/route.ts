import { NextResponse } from "next/server";
import { validateMagicToken } from "@/lib/authTokens";
import {
  getCustomer,
  getMonthlyReport,
  listMonths,
  getDailySeries,
} from "@/lib/reports";
import { monthRange } from "@/lib/format";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const month = searchParams.get("month") || undefined;

  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const v = await validateMagicToken(token);
  if (!v.ok)
    return NextResponse.json({ error: `Token ${v.reason}` }, { status: 401 });

  const customer = await getCustomer(v.customerId);
  const report = await getMonthlyReport(v.customerId, month);

  if (!report) {
    return NextResponse.json(
      { customer, months: [], report: null, series: [] },
      { status: 200 },
    );
  }

  const months = await listMonths(v.customerId);
  const range = monthRange(report.month);
  const series = await getDailySeries(
    v.customerId,
    range.start,
    range.endExclusive,
  );

  return NextResponse.json(
    { customer, months, report, series },
    { status: 200 },
  );
}
