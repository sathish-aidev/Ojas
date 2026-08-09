import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatDate } from "@/lib/utils";
import { formatPdfCurrency, formatGymDisplayName } from "@/lib/pdf/format-pdf";
import {
  PT_REPORT_COL,
  PT_REPORT_TABLE_WIDTH,
  PT_REPORT_LABEL_WIDTH,
  PtReportCell,
} from "@/lib/pdf/pt-report-columns";
import { getMonthName } from "@/lib/permissions";
import type { TrainerMonthlyReportRow } from "@/lib/services/trainer-monthly-report";

/** Fixed column widths (pt) — prevents Monthly Fee / Paid On overlap in PDF. */
const COL = PT_REPORT_COL;
const TABLE_WIDTH = PT_REPORT_TABLE_WIDTH;
const LABEL_WIDTH = PT_REPORT_LABEL_WIDTH;

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 18 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 3 },
  subtitle: { fontSize: 11, color: "#555" },
  meta: { marginTop: 12, marginBottom: 4, fontSize: 10, color: "#333" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 8,
    color: "#111",
  },
  salaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  salaryLabel: { color: "#444" },
  salaryValue: { fontWeight: "bold" },
  netPayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  netPayLabel: { fontSize: 12, fontWeight: "bold" },
  netPayValue: { fontSize: 12, fontWeight: "bold" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 5,
    paddingHorizontal: 2,
    fontWeight: "bold",
    fontSize: 7,
    width: TABLE_WIDTH,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    fontSize: 7,
    width: TABLE_WIDTH,
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  footerRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontSize: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
    width: TABLE_WIDTH,
  },
  footerBold: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 2,
    fontSize: 8,
    fontWeight: "bold",
    borderTopWidth: 1,
    borderTopColor: "#333",
    width: TABLE_WIDTH,
  },
  cellRight: { textAlign: "right" },
  footerLabel: { textAlign: "right", paddingRight: 4 },
});

const PtCell = PtReportCell;

export type PayStubProps = {
  gymName: string;
  employeeName: string;
  employeeType: string;
  month: number;
  year: number;
  baseSalary: number;
  commission: number;
  incentives: number;
  deductions: number;
  expenses: number;
  grossPay: number;
  netPay: number;
  paidAt?: Date | null;
  lineItems: Array<{ label: string; amount: number; isDeduction: boolean }>;
  reportRows?: TrainerMonthlyReportRow[];
  totalPtRevenue?: number;
};

export function PayStubDocument(props: PayStubProps) {
  const isTrainer = props.employeeType === "TRAINER";
  const hasPtReport = isTrainer && props.reportRows && props.reportRows.length > 0;

  const totalPtRevenue =
    props.totalPtRevenue ??
    (props.reportRows?.reduce(
      (sum, row) => sum + (row.amountPaidThisMonth ?? 0),
      0
    ) ?? 0);

  const totalTrainerShare =
    props.reportRows?.reduce((sum, row) => sum + row.trainerShare, 0) ?? props.commission;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{formatGymDisplayName(props.gymName)}</Text>
          <Text style={styles.subtitle}>
            Pay Stub — {getMonthName(props.month)} {props.year}
          </Text>
        </View>

        <Text style={styles.meta}>Employee: {props.employeeName}</Text>
        <Text style={styles.meta}>Role: {props.employeeType}</Text>
        {props.paidAt && (
          <Text style={styles.meta}>Paid on: {formatDate(props.paidAt)}</Text>
        )}

        <Text style={styles.sectionTitle}>Salary</Text>
        <View>
          <View style={styles.salaryRow}>
            <Text style={styles.salaryLabel}>Base Salary</Text>
            <Text style={styles.salaryValue}>{formatPdfCurrency(props.baseSalary)}</Text>
          </View>
          {isTrainer && props.commission > 0 && (
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>PT Share</Text>
              <Text style={styles.salaryValue}>{formatPdfCurrency(props.commission)}</Text>
            </View>
          )}
          {props.incentives > 0 && (
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Incentives</Text>
              <Text style={styles.salaryValue}>{formatPdfCurrency(props.incentives)}</Text>
            </View>
          )}
          {props.deductions > 0 && (
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Deductions</Text>
              <Text style={styles.salaryValue}>-{formatPdfCurrency(props.deductions)}</Text>
            </View>
          )}
          {props.expenses > 0 && (
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Expenses</Text>
              <Text style={styles.salaryValue}>-{formatPdfCurrency(props.expenses)}</Text>
            </View>
          )}
          <View style={styles.netPayRow}>
            <Text style={styles.netPayLabel}>Net Pay</Text>
            <Text style={styles.netPayValue}>{formatPdfCurrency(props.netPay)}</Text>
          </View>
        </View>

        {hasPtReport && (
          <View>
            <Text style={styles.sectionTitle}>PT Report</Text>
            <View style={styles.tableHeader}>
              <PtCell width={COL.num}>#</PtCell>
              <PtCell width={COL.client}>Client</PtCell>
              <PtCell width={COL.date}>Start</PtCell>
              <PtCell width={COL.date}>End</PtCell>
              <PtCell width={COL.mo} align="right">
                Mo
              </PtCell>
              <PtCell width={COL.monthlyFee} align="right">
                Monthly Fee
              </PtCell>
              <PtCell width={COL.paidOn} align="right">
                Paid On
              </PtCell>
              <PtCell width={COL.monthRevenue} align="right">
                This Month Revenue
              </PtCell>
              <PtCell width={COL.split} align="right">
                Split
              </PtCell>
              <PtCell width={COL.share} align="right">
                Share
              </PtCell>
            </View>
            {props.reportRows!.map((row, i) => (
              <View
                key={row.paymentId ?? i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <PtCell width={COL.num}>{i + 1}</PtCell>
                <PtCell width={COL.client}>{row.clientName}</PtCell>
                <PtCell width={COL.date}>{formatDate(row.subscriptionStart)}</PtCell>
                <PtCell width={COL.date}>{formatDate(row.subscriptionEnd)}</PtCell>
                <PtCell width={COL.mo} align="right">
                  {row.monthsCount}
                </PtCell>
                <PtCell width={COL.monthlyFee} align="right">
                  {formatPdfCurrency(row.monthlyShare)}
                </PtCell>
                <PtCell width={COL.paidOn} align="right">
                  {formatDate(row.paidOn)}
                </PtCell>
                <PtCell width={COL.monthRevenue} align="right">
                  {row.amountPaidThisMonth !== null && row.amountPaidThisMonth !== undefined
                    ? formatPdfCurrency(row.amountPaidThisMonth)
                    : "—"}
                </PtCell>
                <PtCell width={COL.split} align="right">
                  {row.splitPercent}%
                </PtCell>
                <PtCell width={COL.share} align="right">
                  {formatPdfCurrency(row.trainerShare)}
                </PtCell>
              </View>
            ))}
            <View style={styles.footerRow}>
              <PtCell width={LABEL_WIDTH} align="right">
                Total PT Revenue (this month)
              </PtCell>
              <PtCell width={COL.monthRevenue} align="right">
                {formatPdfCurrency(totalPtRevenue)}
              </PtCell>
              <PtCell width={COL.split} />
              <PtCell width={COL.share} />
            </View>
            <View style={styles.footerBold}>
              <PtCell width={LABEL_WIDTH + COL.monthRevenue + COL.split} align="right" bold>
                Total Trainer Share
              </PtCell>
              <PtCell width={COL.share} align="right" bold>
                {formatPdfCurrency(totalTrainerShare)}
              </PtCell>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
