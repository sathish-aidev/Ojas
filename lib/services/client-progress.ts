import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";

export async function getClientProgress(clientId: string) {
  const [goals, measurements, notes, dietPrograms, photos] = await Promise.all([
    prisma.goal.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    prisma.measurement.findMany({ where: { clientId }, orderBy: { recordedAt: "asc" } }),
    prisma.clientNote.findMany({
      where: { clientId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.dietProgram.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    prisma.progressPhoto.findMany({ where: { clientId }, orderBy: { takenAt: "desc" } }),
  ]);

  return { goals, measurements, notes, dietPrograms, photos };
}

export function groupMeasurementsByType(
  measurements: Array<{ type: string; value: { toString(): string }; recordedAt: Date; unit: string }>
) {
  const grouped: Record<string, Array<{ value: number; recordedAt: string; unit: string }>> = {};

  for (const m of measurements) {
    if (!grouped[m.type]) grouped[m.type] = [];
    grouped[m.type].push({
      value: decimalToNumber(m.value),
      recordedAt: m.recordedAt.toISOString(),
      unit: m.unit,
    });
  }

  return grouped;
}

export async function addMeasurement(data: {
  clientId: string;
  type: string;
  value: number;
  unit?: string;
  frequency?: string;
  recordedAt?: Date;
  notes?: string;
}) {
  return prisma.measurement.create({
    data: {
      clientId: data.clientId,
      type: data.type as never,
      value: data.value,
      unit: data.unit ?? "kg",
      frequency: (data.frequency as never) ?? "WEEKLY",
      recordedAt: data.recordedAt ?? new Date(),
      notes: data.notes,
    },
  });
}

export async function addGoal(data: {
  clientId: string;
  goalType: string;
  title: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  deadline?: Date;
  notes?: string;
}) {
  return prisma.goal.create({
    data: {
      clientId: data.clientId,
      goalType: data.goalType as never,
      title: data.title,
      targetValue: data.targetValue,
      currentValue: data.currentValue,
      unit: data.unit,
      deadline: data.deadline,
      notes: data.notes,
    },
  });
}

export async function addClientNote(data: {
  clientId: string;
  content: string;
  isPinned?: boolean;
}) {
  return prisma.clientNote.create({
    data: {
      clientId: data.clientId,
      content: data.content,
      isPinned: data.isPinned ?? false,
    },
  });
}

export async function addDietProgram(data: {
  clientId: string;
  title: string;
  content: string;
  startDate?: Date;
  endDate?: Date;
  adherenceNotes?: string;
}) {
  return prisma.dietProgram.create({
    data: {
      clientId: data.clientId,
      title: data.title,
      content: data.content,
      startDate: data.startDate ?? new Date(),
      endDate: data.endDate,
      adherenceNotes: data.adherenceNotes,
    },
  });
}

export async function addProgressPhoto(data: {
  clientId: string;
  imageUrl: string;
  caption?: string;
  takenAt?: Date;
}) {
  return prisma.progressPhoto.create({ data });
}
