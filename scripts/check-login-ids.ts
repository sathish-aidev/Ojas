/**
 * Prints prod/local login IDs and whether password123 still matches.
 *   npx tsx scripts/check-login-ids.ts
 *   npx tsx scripts/check-login-ids.ts --prod
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prod = process.argv.includes("--prod");
config({ path: prod ? ".env.vercel.production" : ".env", override: true });

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  console.log(prod ? "production users" : "local users");
  for (const user of users) {
    const password123 = await bcrypt.compare("password123", user.passwordHash);
    console.log(
      `${user.isActive ? "active" : "inactive"} ${user.role.padEnd(10)} ${user.username.padEnd(16)} ${user.email.padEnd(28)} ${user.name}  password123=${password123 ? "yes" : "NO"}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
