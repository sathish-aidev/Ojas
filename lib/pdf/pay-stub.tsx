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
import type { TrainerMonthlyReportRow } from "@/lib/services/trainer-monthly-report";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#666" },
  section: { marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  label: { color: "#444" },
  value: { fontWeight: "bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 },
  total: { fontSize: 14, fontWeight: "bold", marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: { flexDirection: "row", paddingVertical: 3, fontSize: 8 },
  colClient: { width: "18%" },
  colDate: { width: "10%" },
  colSmall: { width: "6%", textAlign: "right" },
  colAmount: { width: "12%", textAlign: "right" },
  colSplit: { width: "10%", textAlign: "right" },
  colShare: { width: "14%", textAlign: "right" },
});

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
};

export function PayStubDocument(props: PayStubProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{props.gymName}</Text>
          <Text style={styles.subtitle}>Pay Stub — {getMonthName(props.month)} {props.year}</Text>
        </View>

        <View style={styles.section}>
          <Text>Employee: {props.employeeName}</Text>
          <Text>Role: {props.employeeType}</Text>
          {props.paidAt && <Text>Paid on: {formatDate(props.paidAt)}</Text>}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={{ fontWeight: "bold", marginBottom: 8 }}>Earnings</Text>
          {props.lineItems
            .filter((item) => !item.isDeduction)
            .map((item, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
        </View>

        {props.lineItems.some((i) => i.isDeduction) && (
          <View style={styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 8 }}>Deductions</Text>
            {props.lineItems
              .filter((item) => item.isDeduction)
              .map((item, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.value}>-{formatCurrency(item.amount)}</Text>
                </View>
              ))}
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.total}>Net Pay</Text>
          <Text style={styles.total}>{formatCurrency(props.netPay)}</Text>
        </View>

        {props.reportRows && props.reportRows.length > 0 && (
          <View style={styles.section}>
            <Text style={{ fontWeight: "bold", marginBottom: 8, marginTop: 12 }}>
              PT Commission Detail
            </Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colClient}>Client</Text>
              <Text style={styles.colDate}>Start</Text>
              <Text style={styles.colDate}>End</Text>
              <Text style={styles.colSmall}>Mo</Text>
              <Text style={styles.colAmount}>Monthly</Text>
              <Text style={styles.colDate}>Paid On</Text>
              <Text style={styles.colAmount}>Paid/mo</Text>
              <Text style={styles.colSplit}>Split</Text>
              <Text style={styles.colShare}>Share</Text>
            </View>
            {props.reportRows.map((row, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colClient}>{row.clientName}</Text>
                <Text style={styles.colDate}>{formatDate(row.subscriptionStart)}</Text>
                <Text style={styles.colDate}>{formatDate(row.subscriptionEnd)}</Text>
                <Text style={styles.colSmall}>{row.monthsCount}</Text>
                <Text style={styles.colAmount}>{formatCurrency(row.monthlyShare)}</Text>
                <Text style={styles.colDate}>
                  {formatDate(
                    "paidOn" in row && row.paidOn
                      ? row.paidOn
                      : (row as { collectedAt?: Date }).collectedAt ?? row.serviceMonth
                  )}
                </Text>
                <Text style={styles.colAmount}>
                  {row.amountPaidThisMonth !== null && row.amountPaidThisMonth !== undefined
                    ? formatCurrency(row.amountPaidThisMonth)
                    : "—"}
                </Text>
                <Text style={styles.colSplit}>{row.splitPercent}%</Text>
                <Text style={styles.colShare}>{formatCurrency(row.trainerShare)}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
