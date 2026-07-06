import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getMonthName } from "@/lib/permissions";
import type { TrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";

const COL_SPAN = 10;

export function TrainerMonthlyReportTable({
  report,
  showPayrollSummary = true,
}: {
  report: TrainerMonthlyReport;
  showPayrollSummary?: boolean;
}) {
  const { trainer, period, rows, summary } = report;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {getMonthName(period.month)} {period.year}
        </span>
        <span>·</span>
        <span>{trainer.activeSplitPercent}% split</span>
        {trainer.flatSplitPeriod && (
          <>
            <span>·</span>
            <Badge variant="secondary">Flat {trainer.activeSplitPercent}% rate</Badge>
          </>
        )}
        {trainer.hasTarget && (
          <>
            <span>·</span>
            <span>
              Target {formatCurrency(trainer.monthlyTarget!)}
              {trainer.targetMet ? (
                <Badge variant="success" className="ml-2">
                  Met
                </Badge>
              ) : (
                <Badge variant="warning" className="ml-2">
                  Below
                </Badge>
              )}
            </span>
          </>
        )}
        {summary.payrollGenerated && (
          <Badge variant={summary.payrollStatus === "PAID" ? "success" : "secondary"}>
            Payroll {summary.payrollStatus}
            {summary.payrollGenerated ? " · Snapshot locked" : ""}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Lists all clients active this month. Split % applies to every active PT based on whether
        collections in {getMonthName(period.month)} {period.year} met the target. Paid This Month
        shows cash collected this month; Paid On is when the client actually paid.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium text-right">Months</th>
              <th className="px-3 py-2 font-medium text-right">Monthly Share</th>
              <th className="px-3 py-2 font-medium text-right">Paid On</th>
              <th className="px-3 py-2 font-medium text-right">Paid This Month</th>
              <th className="px-3 py-2 font-medium text-right">Split %</th>
              <th className="px-3 py-2 font-medium text-right">Trainer Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COL_SPAN} className="px-3 py-8 text-center text-muted-foreground">
                  No active PT clients for this month.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.paymentId} className="border-b last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{row.clientName}</td>
                  <td className="px-3 py-2">{formatDate(row.subscriptionStart)}</td>
                  <td className="px-3 py-2">{formatDate(row.subscriptionEnd)}</td>
                  <td className="px-3 py-2 text-right">{row.monthsCount}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.monthlyShare)}</td>
                  <td className="px-3 py-2 text-right">{formatDate(row.paidOn)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {row.amountPaidThisMonth !== null
                      ? formatCurrency(row.amountPaidThisMonth)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{row.splitPercent}%</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(row.trainerShare)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td colSpan={7} className="px-3 py-2 text-right">
                  Total PT Revenue (this month)
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(summary.totalPtRevenue)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">
                  {formatCurrency(summary.totalTrainerShare)}
                </td>
              </tr>
              {showPayrollSummary && (
                <>
                  <tr className="border-t">
                    <td colSpan={9} className="px-3 py-2 text-right text-muted-foreground">
                      Base Salary
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(summary.baseSalary)}</td>
                  </tr>
                  {summary.incentives > 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right text-muted-foreground">
                        Incentives
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(summary.incentives)}
                      </td>
                    </tr>
                  )}
                  {(summary.deductions > 0 || summary.expenses > 0) && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-right text-muted-foreground">
                        Deductions / Expenses
                      </td>
                      <td className="px-3 py-2 text-right">
                        -{formatCurrency(summary.deductions + summary.expenses)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t bg-primary/5 font-bold">
                    <td colSpan={9} className="px-3 py-2 text-right">
                      Net Payable
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(summary.netPay)}</td>
                  </tr>
                </>
              )}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
