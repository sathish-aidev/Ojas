import React from "react";
import { Text } from "@react-pdf/renderer";

/** Fixed column widths (pt) for PT report tables in PDF. */
export const PT_REPORT_COL = {
  num: 16,
  client: 68,
  date: 44,
  mo: 18,
  monthlyFee: 52,
  paidOn: 44,
  monthRevenue: 56,
  split: 28,
  share: 52,
} as const;

export const PT_REPORT_TABLE_WIDTH =
  PT_REPORT_COL.num +
  PT_REPORT_COL.client +
  PT_REPORT_COL.date +
  PT_REPORT_COL.date +
  PT_REPORT_COL.mo +
  PT_REPORT_COL.monthlyFee +
  PT_REPORT_COL.paidOn +
  PT_REPORT_COL.monthRevenue +
  PT_REPORT_COL.split +
  PT_REPORT_COL.share;

export const PT_REPORT_LABEL_WIDTH =
  PT_REPORT_COL.num +
  PT_REPORT_COL.client +
  PT_REPORT_COL.date +
  PT_REPORT_COL.date +
  PT_REPORT_COL.mo +
  PT_REPORT_COL.monthlyFee +
  PT_REPORT_COL.paidOn;

export function PtReportCell({
  width,
  align = "left",
  bold = false,
  children,
}: {
  width: number;
  align?: "left" | "right";
  bold?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Text
      style={{
        width,
        textAlign: align,
        fontWeight: bold ? "bold" : "normal",
      }}
    >
      {children ?? ""}
    </Text>
  );
}
