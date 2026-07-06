import { z } from "zod";
import { emptyToUndefined } from "@/lib/form-utils";

const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional()
);

const optionalPositiveAmount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().positive().optional()
);

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["SUPERVISOR", "TRAINER"]),
  employeeType: z.enum(["TRAINER", "MANAGER", "CLEANING"]).optional(),
  baseSalary: z.coerce.number().min(0).default(0),
  monthlyTarget: z.coerce.number().min(0).optional(),
  revenueSplitBelowTarget: z.coerce.number().min(0).max(100).optional(),
  revenueSplitAboveTarget: z.coerce.number().min(0).max(100).optional(),
  phone: z.string().optional(),
});

export const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  trainerId: z.string().optional(),
  joinDate: z.string().optional(),
});

export const paymentModeSchema = z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]);

export const subscriptionSchema = z.object({
  clientId: z.string(),
  amount: z.coerce.number().positive(),
  paymentDate: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  monthsCount: optionalPositiveInt,
  paymentMode: paymentModeSchema.optional(),
  sessionsTotal: optionalPositiveInt,
  notes: z.string().optional(),
});

export const sessionSchema = z.object({
  clientId: z.string(),
  scheduledAt: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("SCHEDULED"),
  notes: z.string().optional(),
});

export const slotSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  isBlocked: z.boolean().default(false),
  label: z.string().optional(),
  clientId: z.string().optional(),
});

export const goalSchema = z.object({
  clientId: z.string(),
  goalType: z.enum(["WEIGHT_LOSS", "FITNESS", "MUSCLE_GAIN", "CUSTOM"]),
  title: z.string().min(2),
  targetValue: z.coerce.number().optional(),
  currentValue: z.coerce.number().optional(),
  unit: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

export const measurementSchema = z.object({
  clientId: z.string(),
  type: z.enum([
    "WEIGHT",
    "BODY_FAT",
    "CHEST",
    "WAIST",
    "HIPS",
    "BICEPS",
    "THIGHS",
    "CALVES",
    "SHOULDERS",
    "CUSTOM",
  ]),
  value: z.coerce.number(),
  unit: z.string().default("kg"),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).default("WEEKLY"),
  recordedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const noteSchema = z.object({
  clientId: z.string(),
  content: z.string().min(1),
  isPinned: z.boolean().default(false),
});

export const dietSchema = z.object({
  clientId: z.string(),
  title: z.string().min(2),
  content: z.string().min(2),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  adherenceNotes: z.string().optional(),
});

export const payrollGenerateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
});

export const payrollPaySchema = z.object({
  payrollRunId: z.string(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

export const employeeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  baseSalary: z.coerce.number().min(0).optional(),
  monthlyTarget: z.coerce.number().min(0).optional(),
  revenueSplitBelowTarget: z.coerce.number().min(0).max(100).optional(),
  revenueSplitAboveTarget: z.coerce.number().min(0).max(100).optional(),
  phone: z.string().optional(),
});

const splitRuleFieldsSchema = z.object({
  startMonth: z.coerce.number().int().min(1).max(12),
  startYear: z.coerce.number().int().min(2020).max(2100),
  endMonth: z.coerce.number().int().min(1).max(12).nullable().optional(),
  endYear: z.coerce.number().int().min(2020).max(2100).nullable().optional(),
  mode: z.enum(["FLAT", "TARGET_BASED"]),
  flatPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  monthlyTarget: z.coerce.number().min(0).nullable().optional(),
  splitBelowTarget: z.coerce.number().min(0).max(100).nullable().optional(),
  splitAboveTarget: z.coerce.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  recalculate: z.boolean().optional(),
});

function refineSplitRuleFields(
  data: Partial<z.infer<typeof splitRuleFieldsSchema>>,
  ctx: z.RefinementCtx,
  partial = false
) {
  if (data.mode === "FLAT") {
    if (!partial && (data.flatPercent == null || data.flatPercent === undefined)) {
      ctx.addIssue({ code: "custom", message: "Flat percent required", path: ["flatPercent"] });
    }
    if (partial && data.flatPercent === null) {
      ctx.addIssue({ code: "custom", message: "Flat percent required", path: ["flatPercent"] });
    }
  }
  if (data.mode === "TARGET_BASED") {
    if (!partial && data.splitBelowTarget == null) {
      ctx.addIssue({
        code: "custom",
        message: "Below-target split required",
        path: ["splitBelowTarget"],
      });
    }
    if (!partial && data.splitAboveTarget == null) {
      ctx.addIssue({
        code: "custom",
        message: "Above-target split required",
        path: ["splitAboveTarget"],
      });
    }
  }
}

export const splitRuleSchema = splitRuleFieldsSchema.superRefine((data, ctx) =>
  refineSplitRuleFields(data, ctx, false)
);

/** Partial updates — full validation runs after merge in updateSplitRule. */
export const splitRuleUpdateSchema = splitRuleFieldsSchema
  .partial()
  .extend({ recalculate: z.boolean().optional() })
  .superRefine((data, ctx) => refineSplitRuleFields(data, ctx, true));

export const splitRuleApplySchema = z.object({
  fromMonth: z.coerce.number().int().min(1).max(12),
  fromYear: z.coerce.number().int().min(2020),
  toMonth: z.coerce.number().int().min(1).max(12).optional(),
  toYear: z.coerce.number().int().min(2020).optional(),
});

export const createClientWithPtSchema = clientSchema.extend({
  amount: optionalPositiveAmount,
  paymentDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  monthsCount: optionalPositiveInt,
  paymentMode: paymentModeSchema.optional(),
  sessionsTotal: optionalPositiveInt,
  ptNotes: z.string().optional(),
});

export const gymSettingsSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
  renewalReminderDays: z.coerce.number().int().min(1).max(60),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
