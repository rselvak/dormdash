"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { sendPendingStudentVerifications, studentVerificationReset } from "@/lib/student-email-verification";
import { describeUniqueError } from "@/lib/registrations";
import { parentProfileSchema, studentSchema } from "@/lib/validation/registration";

const schema = z.object({
  parent: parentProfileSchema,
  students: z.array(studentSchema.and(z.object({ id: z.string().optional() }))).max(10),
});

export async function saveProfile(input: unknown) {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Sign in to edit your profile." };
  const user = await currentUser();
  const primary = user?.primaryEmailAddress;
  if (!primary || primary.verification?.status !== "verified") return { ok: false, message: "Verify your primary login email in Account settings first." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map(issue => `${issue.path[0] === "students" ? `Student ${Number(issue.path[1]) + 1}: ` : ""}${issue.message}`).join("\n") };
  const { parent, students } = parsed.data;
  const ids = students.flatMap(student => student.id ? [student.id] : []);
  if (new Set(ids).size !== ids.length || new Set(students.map(student => student.email)).size !== students.length) return { ok: false, message: "Each student must have a different email and record." };
  try {
    await getPrisma().$transaction(async tx => {
      const family = await tx.parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
      if (!family) throw new Error("Registration not found");
      // Serialize profile saves and verify every submitted student belongs to this account.
      await tx.$queryRaw`SELECT "id" FROM "Parent" WHERE "id" = ${family.id} FOR UPDATE`;
      const owned = await tx.student.count({ where: { parentId: family.id, id: { in: ids } } });
      if (owned !== ids.length) throw new Error("Student does not belong to this account");
      await tx.parent.update({ where: { id: family.id }, data: { ...parent, email: primary.emailAddress.toLowerCase(), parent2Name: parent.parent2Name || null, parent2Email: parent.parent2Email || null, parent2Phone: parent.parent2Phone || null } });
      await tx.student.deleteMany({ where: { parentId: family.id, id: { notIn: ids } } });
      for (const student of students) {
        const { id, ...data } = student;
        if (id) {
          const current = await tx.student.findUnique({ where: { id, parentId: family.id }, select: { email: true, college: true, verifyCollegeEmail: true } });
          if (!current) throw new Error("Student not found");
          await tx.student.update({ where: { id, parentId: family.id }, data: { ...data, ...studentVerificationReset(current, data) } });
        }
        else await tx.student.create({ data: { ...data, parentId: family.id } });
      }
    });
    await sendPendingStudentVerifications(userId).catch(() => undefined);
    for (const path of ["/profile", "/dashboard", "/", "/my-events"]) revalidatePath(path);
    return { ok: true, message: "Profile saved." };
  } catch (error) {
    console.error("Profile update failed", error);
    return { ok: false, message: describeUniqueError(error) || "Unable to save your profile. Refresh and try again." };
  }
}
