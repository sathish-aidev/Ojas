import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Removes all client data so you can start fresh. Keeps gym, users, trainers. */
async function main() {
  await prisma.notification.deleteMany();
  await prisma.payrollLineItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.progressPhoto.deleteMany();
  await prisma.dietProgram.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.pTSubscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.trainerSlot.deleteMany();
  await prisma.client.deleteMany();

  console.log("All clients and PT data cleared. Trainers and owner accounts kept.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
