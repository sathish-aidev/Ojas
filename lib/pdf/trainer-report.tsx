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
  PT_REPORT_COL as COL,
  PT_REPORT_TABLE_WIDTH as TABLE_WIDTH,
  PT_REPORT_LABEL_WIDTH as LABEL_WIDTH,
  PtReportCell as PtCell,
} from "@/lib/pdf/pt-report-columns";
import { getMonthName } from "@/lib/permissions";
import type { TrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 3 },
  subtitle: { fontSize: 11, color: "#555", marginBottom: 14 },
  meta: { fontSize: 9, marginBottom: 12, color: "#666" },
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
});

export function TrainerReportDocument({
  gymName,
  report,
}: {
  gymName: string;
  report: TrainerMonthlyReport;
}) {
  const { trainer, period, rows, summary } = report;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{formatGymDisplayName(gymName)}</Text>
        <Text style={styles.subtitle}>
          PT Report — {trainer.name} — {getMonthName(period.month)} {period.year}
        </Text>
        <Text style={styles.meta}>
          {trainer.activeSplitPercent}% split · All active PTs this month
          {trainer.hasTarget && trainer.monthlyTarget
            ? ` · Target ${formatPdfCurrency(trainer.monthlyTarget)}${trainer.targetMet ? " (met)" : ""}`
            : ""}
        </Text>

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

        {rows.length === 0 ? (
          <Text style={{ color: "#666", marginTop: 8 }}>No active PT clients for this month.</Text>
        ) : (
          rows.map((row, i) => (
            <View
              key={row.paymentId}
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
                {row.amountPaidThisMonth !== null
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
          ))
        )}

        {rows.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <View style={styles.footerRow}>
              <PtCell width={LABEL_WIDTH} align="right">
                Total PT Revenue (this month)
              </PtCell>
              <PtCell width={COL.monthRevenue} align="right">
                {formatPdfCurrency(summary.totalPtRevenue)}
              </PtCell>
              <PtCell width={COL.split} />
              <PtCell width={COL.share} />
            </View>
            <View style={styles.footerBold}>
              <PtCell width={LABEL_WIDTH + COL.monthRevenue + COL.split} align="right" bold>
                Total Trainer Share
              </PtCell>
              <PtCell width={COL.share} align="right" bold>
                {formatPdfCurrency(summary.totalTrainerShare)}
              </PtCell>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
