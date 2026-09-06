import { config } from "dotenv";
config({ path: ".env.staging", override: true });
import { prisma } from "../lib/prisma";

async function main() {
  const gym = await prisma.gym.findFirst();
  const clients = await prisma.client.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  const users = await prisma.user.findMany({ select: { username: true, role: true }, orderBy: { username: "asc" } });
  console.log("gym:", gym?.name);
  console.log("users:", users.map((u) => `${u.username} (${u.role})`).join(", "));
  console.log("clients:", clients.map((c) => c.name).join(", "));
}

main().finally(() => prisma.$disconnect());
