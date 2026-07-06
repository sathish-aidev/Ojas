import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [subs, clients, payments] = await Promise.all([
    prisma.pTSubscription.count(),
    prisma.client.count(),
    prisma.payment.count(),
  ]);

  const trainers = await prisma.employee.findMany({
    where: {
      employeeType: "TRAINER",
      user: { name: { in: ["Sai", "Rohith", "Rahul"] } },
    },
    include: {
      user: true,
      _count: { select: { clients: true } },
    },
  });

  console.log({ totalSubscriptions: subs, totalClients: clients, totalPayments: payments });
  for (const t of trainers) {
    const subCount = await prisma.pTSubscription.count({
      where: { client: { trainerId: t.id } },
    });
    console.log(`  ${t.user.name}: ${t._count.clients} clients, ${subCount} subscriptions`);
  }
}

main()
  .finally(() => prisma.$disconnect());
