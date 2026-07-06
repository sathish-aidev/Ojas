import { requireOwner } from "@/lib/session";

import { prisma } from "@/lib/prisma";

import { getTrainerOverview } from "@/lib/services/pt-tracker";

import { CreateUserForm } from "@/components/forms/create-forms";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { TrainerSplitEditor } from "@/components/owner/owner-dashboard-forms";

import { UserActions } from "@/components/owner/user-actions";



export default async function OwnerTrainersPage() {

  const user = await requireOwner();



  const [trainers, users] = await Promise.all([

    getTrainerOverview(user.gymId),

    prisma.user.findMany({

      where: { gymId: user.gymId, role: { not: "OWNER" } },

      include: { employee: true },

      orderBy: { name: "asc" },

    }),

  ]);



  return (

    <div className="space-y-6">

      <div>

        <h1 className="text-2xl font-bold">Team Management</h1>

        <p className="text-muted-foreground">Create accounts, edit targets, and set revenue splits</p>

      </div>



      <CreateUserForm />



      <TrainerSplitEditor

        trainers={trainers}

        title="Trainers Performance & Split Settings (MTD)"

      />



      <Card>

        <CardHeader>

          <CardTitle className="text-lg">All Team Members</CardTitle>

        </CardHeader>

        <CardContent className="space-y-3">

          {users.map((u) => (

            <div

              key={u.id}

              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"

            >

              <div>

                <p className="font-medium">{u.name}</p>

                <p className="text-sm text-muted-foreground">

                  {u.email} · {u.role} · {u.employee?.employeeType}

                </p>

              </div>

              <UserActions userId={u.id} userName={u.name} isActive={u.isActive} />

            </div>

          ))}

        </CardContent>

      </Card>

    </div>

  );

}

