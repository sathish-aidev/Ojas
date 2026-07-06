import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getMonthName } from "@/lib/permissions";
import type { TrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: { flexDirection: "row", paddingVertical: 3, fontSize: 8 },
  colNum: { width: "4%" },
  colClient: { width: "14%" },
  colDate: { width: "9%" },
  colSmall: { width: "5%", textAlign: "right" },
  colAmount: { width: "10%", textAlign: "right" },
  colSplit: { width: "7%", textAlign: "right" },
  colShare: { width: "10%", textAlign: "right" },
  footer: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#ccc", paddingTop: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  footerBold: { fontWeight: "bold", fontSize: 11 },
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
        <Text style={styles.title}>{gymName}</Text>
        <Text style={styles.subtitle}>
          PT Report — {trainer.name} — {getMonthName(period.month)} {period.year}
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 12, color: "#666" }}>
          {trainer.activeSplitPercent}% split · All active PTs this month
          {trainer.hasTarget && trainer.monthlyTarget
            ? ` · Target ${formatCurrency(trainer.monthlyTarget)}${trainer.targetMet ? " (met)" : ""}`
            : ""}
        </Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colNum}>#</Text>
          <Text style={styles.colClient}>Client</Text>
          <Text style={styles.colDate}>Start</Text>
          <Text style={styles.colDate}>End</Text>
          <Text style={styles.colSmall}>Mo</Text>
          <Text style={styles.colAmount}>Monthly</Text>
          <Text style={styles.colDate}>Paid On</Text>
          <Text style={styles.colAmount}>Paid/mo</Text>
          <Text style={styles.colSplit}>Split</Text>
          <Text style={styles.colShare}>Trainer</Text>
        </View>

        {rows.length === 0 ? (
          <Text style={{ color: "#666", marginTop: 8 }}>No active PT clients for this month.</Text>
        ) : (
          rows.map((row, i) => (
            <View key={row.paymentId} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colClient}>{row.clientName}</Text>
              <Text style={styles.colDate}>{formatDate(row.subscriptionStart)}</Text>
              <Text style={styles.colDate}>{formatDate(row.subscriptionEnd)}</Text>
              <Text style={styles.colSmall}>{row.monthsCount}</Text>
              <Text style={styles.colAmount}>{formatCurrency(row.monthlyShare)}</Text>
              <Text style={styles.colDate}>{formatDate(row.paidOn)}</Text>
              <Text style={styles.colAmount}>
                {row.amountPaidThisMonth !== null
                  ? formatCurrency(row.amountPaidThisMonth)
                  : "—"}
              </Text>
              <Text style={styles.colSplit}>{row.splitPercent}%</Text>
              <Text style={styles.colShare}>{formatCurrency(row.trainerShare)}</Text>
            </View>
          ))
        )}

        {rows.length > 0 && (
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text>Total PT Revenue (this month)</Text>
              <Text>{formatCurrency(summary.totalPtRevenue)}</Text>
            </View>
            <View style={styles.footerRow}>
              <Text>Total Trainer Share</Text>
              <Text>{formatCurrency(summary.totalTrainerShare)}</Text>
            </View>
            <View style={styles.footerRow}>
              <Text>Base Salary</Text>
              <Text>{formatCurrency(summary.baseSalary)}</Text>
            </View>
            <View style={[styles.footerRow, styles.footerBold]}>
              <Text>Net Payable</Text>
              <Text>{formatCurrency(summary.netPay)}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
