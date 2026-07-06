import { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  gymId: string;
  employeeId?: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  SUPERVISOR: "Supervisor",
  TRAINER: "Trainer",
};

export function canManageUsers(role: UserRole) {
  return role === "OWNER";
}

export function canEditSalaryRules(role: UserRole) {
  return role === "OWNER";
}

export function canRecordPayroll(role: UserRole) {
  return role === "OWNER" || role === "SUPERVISOR";
}

export function canViewAllTrainers(role: UserRole) {
  return role === "OWNER" || role === "SUPERVISOR";
}

export function canManageClients(role: UserRole) {
  return role === "OWNER" || role === "TRAINER";
}

export function canViewClient(role: UserRole, trainerEmployeeId: string, userEmployeeId?: string) {
  if (role === "OWNER" || role === "SUPERVISOR") return true;
  if (role === "TRAINER") return trainerEmployeeId === userEmployeeId;
  return false;
}

export function computeRevenueSplit(amount: number, trainerPercent: number) {
  const trainerShare = (amount * trainerPercent) / 100;
  const ownerShare = amount - trainerShare;
  return {
    trainerShare: Math.round(trainerShare * 100) / 100,
    ownerShare: Math.round(ownerShare * 100) / 100,
  };
}

export function getMonthYear(date: Date = new Date()) {
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export function getMonthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString("en-IN", { month: "long" });
}
