import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

import {
  forbidden,
  badRequest,
  ok,
  notFound,
  requireGymUser,
  handlePrismaError,
} from "@/lib/api-utils";

import { canManageUsers, canEditSalaryRules } from "@/lib/permissions";

import { employeeUpdateSchema } from "@/lib/validations";

import { getMonthYear } from "@/lib/permissions";

import { recalculateTrainerMonthSplits } from "@/lib/services/trainer-split";



export async function PATCH(

  request: Request,

  { params }: { params: Promise<{ id: string }> }

) {

  try {

    const authResult = await requireGymUser();

    if ("error" in authResult) return authResult.error;

    const user = authResult.user;



    const { id } = await params;

    const target = await prisma.user.findFirst({

      where: { id, gymId: user.gymId },

      include: { employee: true },

    });

    if (!target) return notFound();



    const body = await request.json();



    if (body.action === "reset-password") {

      if (!canManageUsers(user.role)) return forbidden();

      if (!body.password || body.password.length < 6) return badRequest("Password min 6 chars");

      const passwordHash = await bcrypt.hash(body.password, 10);

      await prisma.user.update({ where: { id }, data: { passwordHash } });

      return ok({ success: true });

    }



    if (body.action === "toggle-active") {

      if (!canManageUsers(user.role)) return forbidden();

      await prisma.user.update({ where: { id }, data: { isActive: !target.isActive } });

      return ok({ success: true });

    }



    if (body.action === "update-trainer") {

      if (!canEditSalaryRules(user.role)) return forbidden();

      if (!target.employee) return notFound("Employee profile not found");



      const parsed = employeeUpdateSchema.safeParse(body);

      if (!parsed.success) {

        return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");

      }



      const { name: trainerName, ...employeeData } = parsed.data;

      if (trainerName) {

        await prisma.user.update({ where: { id }, data: { name: trainerName } });

      }

      if (Object.keys(employeeData).length > 0) {

        await prisma.employee.update({

          where: { id: target.employee.id },

          data: employeeData,

        });

      }



      const { month, year } = getMonthYear();

      await recalculateTrainerMonthSplits(target.employee.id, month, year);



      return ok({ success: true });

    }



    const parsed = employeeUpdateSchema.safeParse(body);

    if (!parsed.success) return badRequest("Invalid input");

    if (!canEditSalaryRules(user.role)) return forbidden();

    if (!target.employee) return notFound("Employee profile not found");



    const { name, ...employeeData } = parsed.data;

    if (name) {

      await prisma.user.update({ where: { id }, data: { name } });

    }

    if (Object.keys(employeeData).length > 0) {

      await prisma.employee.update({

        where: { id: target.employee.id },

        data: employeeData,

      });

    }



    return ok({ success: true });

  } catch (error) {

    return handlePrismaError(error);

  }

}



export async function DELETE(

  _request: Request,

  { params }: { params: Promise<{ id: string }> }

) {

  try {

    const authResult = await requireGymUser();

    if ("error" in authResult) return authResult.error;

    const user = authResult.user;



    if (!canManageUsers(user.role)) return forbidden();



    const { id } = await params;
    const target = await prisma.user.findFirst({
      where: { id, gymId: user.gymId },
      include: { employee: true },
    });
    if (!target || target.role === "OWNER") return forbidden();

    if (target.employee) {
      const [clientCount, sessionCount] = await Promise.all([
        prisma.client.count({ where: { trainerId: target.employee.id } }),
        prisma.session.count({ where: { trainerId: target.employee.id } }),
      ]);
      if (clientCount > 0 || sessionCount > 0) {
        const parts: string[] = [];
        if (clientCount > 0) parts.push(`${clientCount} client(s)`);
        if (sessionCount > 0) parts.push(`${sessionCount} session(s)`);
        return badRequest(
          `Cannot delete: trainer has ${parts.join(" and ")}. Delete or reassign them first.`
        );
      }
    }

    await prisma.user.delete({ where: { id } });

    return ok({ success: true });

  } catch (error) {

    return handlePrismaError(error);

  }

}

