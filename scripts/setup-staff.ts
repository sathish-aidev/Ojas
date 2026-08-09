/**
 * One-time production setup: rename supervisor to Lokesh, add housekeeping staff.
 * Run: npx tsx scripts/setup-staff.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function ensureHousekeeping(
  gymId: string,
  name: string,
  email: string,
  baseSalary: number
) {
  const existing = await prisma.user.findFirst({
    where: { gymId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    console.log(`  ${name} already exists`);
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: "TRAINER",
      gymId,
      isActive: false,
      employee: {
        create: {
          gymId,
          employeeType: "CLEANING",
          baseSalary,
        },
      },
    },
  });
  console.log(`  Created ${name} (housekeeping, salary tracking only)`);
}

async function main() {
  const gym = await prisma.gym.findFirst();
  if (!gym) throw new Error("No gym found");

  const supervisor = await prisma.user.findFirst({
    where: { gymId: gym.id, role: "SUPERVISOR" },
  });
  if (supervisor && supervisor.name !== "Lokesh") {
    await prisma.user.update({
      where: { id: supervisor.id },
      data: { name: "Lokesh" },
    });
    console.log(`Renamed supervisor: ${supervisor.name} → Lokesh`);
  } else if (supervisor) {
    console.log("Supervisor already named Lokesh");
  } else {
    console.warn("No supervisor user found");
  }

  console.log("Housekeeping staff:");
  await ensureHousekeeping(gym.id, "Yashoda", "yashoda@impackt.gym", 12000);
  await ensureHousekeeping(gym.id, "Rama", "rama@impackt.gym", 12000);

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
