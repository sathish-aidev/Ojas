/**
 * Adds User.username (if missing), fills login IDs, and resets password to
 * password123 only for active users who did not yet have a username.
 * Safe to re-run. Must run before `prisma db push` when username is new.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { suggestedStaffUsername, uniqueUsername, USERNAME_PATTERN } from "../lib/username";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "password123";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  username: string | null;
  isActive: boolean;
};

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/relation ["']?User["']? does not exist/i.test(message)) {
      console.log("User table is not ready yet. prisma db push will create it with username.");
      return;
    }
    throw err;
  }

  const users = await prisma.$queryRaw<UserRow[]>`
    SELECT id, name, email, role, username, "isActive" FROM "User"
  `;

  const used = new Set(
    users
      .map((user) => user.username?.toLowerCase())
      .filter((value): value is string => Boolean(value && USERNAME_PATTERN.test(value)))
  );

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let assigned = 0;
  let passwordsReset = 0;

  for (const user of users) {
    const existing = user.username?.toLowerCase() ?? "";
    if (existing && USERNAME_PATTERN.test(existing)) {
      used.add(existing);
      continue;
    }

    const username = uniqueUsername(
      suggestedStaffUsername({ name: user.name, email: user.email, role: user.role }),
      used
    );
    used.add(username);

    if (user.isActive) {
      await prisma.$executeRaw`
        UPDATE "User"
        SET username = ${username}, "passwordHash" = ${passwordHash}
        WHERE id = ${user.id}
      `;
      passwordsReset += 1;
      console.log(`  ${user.name} → ${username} (password set to ${DEFAULT_PASSWORD})`);
    } else {
      await prisma.$executeRaw`
        UPDATE "User" SET username = ${username} WHERE id = ${user.id}
      `;
      console.log(`  ${user.name} → ${username} (no login)`);
    }
    assigned += 1;
  }

  if (assigned === 0) {
    console.log("All users already have a username. Passwords left unchanged.");
  } else {
    console.log(`Assigned ${assigned} username(s). Reset ${passwordsReset} active password(s).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
