/**
 * Rename trainer Sai → Sai Karan in production DB.
 * Run: npx tsx scripts/rename-sai-karan.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      role: "TRAINER",
      name: { equals: "Sai", mode: "insensitive" },
    },
    data: { name: "Sai Karan" },
  });
  console.log(`Updated ${result.count} user(s) to "Sai Karan"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
