import DashboardView from "@/components/DashboardView";
import { validateMagicToken } from "@/lib/authTokens";
import {
  getCustomer,
  getMonthlyReport,
  listMonths,
  getDailySeries,
} from "@/lib/reports";
import { monthRange } from "@/lib/format";

export default async function MagicReportPage(props: {
  params: Promise<{ token: string }> | { token: string };
  searchParams: Promise<{ month?: string }> | { month?: string };
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const token = params.token;
  const month = searchParams.month;

  const v = await validateMagicToken(token);
  if (!v.ok) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Link ongeldig</div>
          <div className="mt-2 text-white/70">
            Deze magic link is {v.reason}. Vraag een nieuwe link aan bij
            Pixelplus.
          </div>
        </div>
      </div>
    );
  }

  const customer = await getCustomer(v.customerId);
  const report = await getMonthlyReport(v.customerId, month);

  const months = report ? await listMonths(v.customerId) : [];
  const range = report ? monthRange(report.month) : null;
  const series = range
    ? await getDailySeries(v.customerId, range.start, range.endExclusive)
    : [];

  return (
    <DashboardView
      customer={customer}
      report={report}
      months={months}
      series={series}
      token={token}
    />
  );
}
