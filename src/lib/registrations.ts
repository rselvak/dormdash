import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import type {
  ParentProfile,
  RegistrationInput,
  StudentInput,
} from "@/lib/validation/registration";

export type Registration = Prisma.ParentGetPayload<{
  include: { students: true };
}>;

const withStudents = {
  students: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.ParentInclude;

function parentData(parent: ParentProfile) {
  return {
    name: parent.name,
    email: parent.email,
    phone: parent.phone,
    parent2Name: parent.parent2Name || null,
    parent2Phone: parent.parent2Phone || null,
    parent2Email: parent.parent2Email || null,
  };
}

function studentData(student: StudentInput) {
  return {
    name: student.name,
    email: student.email,
    phone: student.phone || null,
    college: student.college,
    dorm: student.dorm || null,
    year: student.year ?? null,
    major: student.major,
  };
}

export async function getRegistration(
  clerkUserId: string,
): Promise<Registration | null> {
  return getPrisma().parent.findUnique({
    where: { clerkUserId },
    include: withStudents,
  });
}

/**
 * Creates the parent and all of their students in one transaction. The unique
 * constraints on `clerkUserId`, the parent email, and each child's email are
 * the last line of defence against duplicate registrations.
 */
export async function saveRegistration(
  clerkUserId: string,
  input: RegistrationInput,
): Promise<Registration> {
  return getPrisma().parent.create({
    data: {
      clerkUserId,
      ...parentData(input.parent),
      students: {
        create: input.students.map(studentData),
      },
    },
    include: withStudents,
  });
}

export async function addStudent(
  clerkUserId: string,
  student: StudentInput,
) {
  const parent = await getPrisma().parent.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!parent) return null;

  return getPrisma().student.create({
    data: {
      parentId: parent.id,
      ...studentData(student),
    },
  });
}

/** Turns Prisma's unique-constraint error into a message worth showing a user. */
export function describeUniqueError(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code !== "P2002") return null;

  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(",")
    : String(error.meta?.target ?? "");

  if (target.includes("clerk_user_id") || target.includes("clerkUserId")) {
    return "This account is already registered. Open your dashboard to see it.";
  }

  if (target.includes("parentId") || target.includes("parent_id")) {
    return "That student is already registered under your account.";
  }

  if (target.includes("email")) {
    return "That email address is already registered. Try signing in instead.";
  }

  return "That record already exists.";
}
