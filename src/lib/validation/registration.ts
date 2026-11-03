import { z } from "zod";

import { getCollege } from "@/lib/colleges";

/**
 * Phone numbers are stored in a light E.164-ish form: an optional leading `+`
 * followed by 7-15 digits. Users can type spaces, dashes, parentheses, etc.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function isValidPhone(value: string): boolean {
  return /^\+?\d{7,15}$/.test(normalizePhone(value));
}

const NAME_MAX = 120;
const COLLEGE_MAX = 160;

function requiredText(label: string, max = NAME_MAX) {
  return z
    .string()
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(max, { error: `${label} must be ${max} characters or fewer.` });
}

function optionalText(max = NAME_MAX) {
  return z.string().trim().max(max, {
    error: `Must be ${max} characters or fewer.`,
  });
}

function requiredEmail(label: string) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: `Enter a valid ${label}.` }));
}

function optionalEmail(label: string) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .default("")
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      error: `Enter a valid ${label}.`,
    });
}

function phoneField(label: string, required = true) {
  return z
    .string()
    .trim()
    .default("")
    .superRefine((value, ctx) => {
      if (!value) {
        if (required) {
          ctx.addIssue({ code: "custom", message: `${label} is required.` });
        }
        return;
      }

      if (!isValidPhone(value)) {
        ctx.addIssue({
          code: "custom",
          message: `Enter a valid ${label.toLowerCase()}.`,
        });
      }
    })
    .transform(normalizePhone);
}

/**
 * Fields shared by the parent step, the full registration, and the account
 * creation schema. Parent 2 is optional, but when present every field must be
 * supplied together.
 */
const parentFields = {
  name: requiredText("Parent 1 name"),
  email: requiredEmail("email address"),
  phone: phoneField("Parent 1 phone number"),
  parent2Name: optionalText(),
  parent2Phone: phoneField("Parent 2 phone number", false),
  parent2Email: optionalEmail("email address"),
};

type ParentFieldValues = {
  parent2Name?: string;
  parent2Phone?: string;
  parent2Email?: string;
};

function validateParent2(
  value: ParentFieldValues,
  ctx: z.RefinementCtx,
  prefix: Array<string | number> = [],
) {
  const provided = [
    value.parent2Name?.trim(),
    value.parent2Phone?.trim(),
    value.parent2Email?.trim(),
  ].filter(Boolean).length;

  if (provided !== 0 && provided !== 3) {
    ctx.addIssue({
      code: "custom",
      path: [...prefix, "parent2Name"],
      message: "Enter all of parent 2's details, or leave all of them blank.",
    });
  }
}

const passwordField = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." })
  .max(72, { error: "Password must be 72 characters or fewer." });

const confirmPasswordField = z
  .string()
  .min(1, { error: "Confirm your password." });

function validatePasswords(
  value: { password?: string; confirmPassword?: string },
  ctx: z.RefinementCtx,
) {
  if (value.password && value.confirmPassword !== value.password) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  }
}

export const parentProfileSchema = z
  .object(parentFields)
  .superRefine((value, ctx) => validateParent2(value, ctx));

/** Parent tab for an existing account: no password fields. */
export const parentStepSchema = parentProfileSchema;

/** Parent tab during sign-up: profile plus the Clerk password. */
export const parentAccountSchema = z
  .object({
    ...parentFields,
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .superRefine((value, ctx) => {
    validateParent2(value, ctx);
    validatePasswords(value, ctx);
  });

export const studentSchema = z
  .object({
    name: requiredText("Student name"),
    email: requiredEmail("student email address"),
    phone: phoneField("Student phone number", false),
    college: requiredText("College name", COLLEGE_MAX),
    dorm: optionalText(),
    year: z
      .number()
      .int({ error: "Choose a year of college." })
      .min(1, { error: "Choose a year of college." })
      .max(4, { error: "Choose a year of college." })
      .nullable()
      .default(null),
    major: requiredText("Major"),
  })
  .superRefine((value, ctx) => {
    const college = getCollege(value.college);

    if (!college) {
      ctx.addIssue({
        code: "custom",
        path: ["college"],
        message: "Choose a college from the list.",
      });
      return;
    }

    if (!college.majors.includes(value.major)) {
      ctx.addIssue({
        code: "custom",
        path: ["major"],
        message: `Choose a major offered at ${college.name}.`,
      });
    }
  });

export const studentsStepSchema = z.object({
  students: z
    .array(studentSchema)
    .min(1, { error: "Add at least one student." })
    .max(10, { error: "You can register up to 10 students at a time." }),
});

function validateStudentEmails(
  students: Array<{ email: string }>,
  ctx: z.RefinementCtx,
  prefix: Array<string | number> = [],
) {
  const seen = new Map<string, number>();

  students.forEach((student, index) => {
    const email = student.email.trim().toLowerCase();
    const firstIndex = seen.get(email);

    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: [...prefix, index, "email"],
        message: "Each student needs a different email address.",
      });
    } else {
      seen.set(email, index);
    }
  });
}

const registrationShape = {
  parent: z.object(parentFields),
  students: z
    .array(studentSchema)
    .min(1, { error: "Add at least one student." })
    .max(10, { error: "You can register up to 10 students at a time." }),
};

/** Server-side and signed-in-onboarding shape. */
export const registrationSchema = z
  .object(registrationShape)
  .superRefine((value, ctx) => {
    validateParent2(value.parent, ctx, ["parent"]);
    validateStudentEmails(value.students, ctx, ["students"]);
  });

/** Full sign-up shape: registration plus Clerk account credentials. */
export const signUpFormSchema = z
  .object({
    ...registrationShape,
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .superRefine((value, ctx) => {
    validateParent2(value.parent, ctx, ["parent"]);
    validateStudentEmails(value.students, ctx, ["students"]);
    validatePasswords(value, ctx);
  });

/** Used by the dashboard's single-student add form. */
export const singleStudentFormSchema = z.object({ student: studentSchema });

export type ParentProfile = z.output<typeof parentProfileSchema>;
export type StudentInput = z.output<typeof studentSchema>;
export type RegistrationInput = z.output<typeof registrationSchema>;

/**
 * Converts Zod issues into a flat map keyed by dot-separated paths, which is
 * exactly what the form fields use for lookup.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !result[key]) {
      result[key] = issue.message;
    }
  }

  return result;
}
