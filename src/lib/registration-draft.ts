import type { z } from "zod";

import type { studentSchema } from "@/lib/validation/registration";

export type SchoolYear = "" | "1" | "2" | "3" | "4";

export type StudentDraft = {
  name: string;
  email: string;
  phone: string;
  college: string;
  dorm: string;
  year: SchoolYear;
  major: string;
};

export type ParentDraft = {
  name: string;
  email: string;
  phone: string;
  parent2Name: string;
  parent2Phone: string;
  parent2Email: string;
  password: string;
  confirmPassword: string;
};

export type RegistrationDraft = {
  parent: ParentDraft;
  students: StudentDraft[];
};

export const YEAR_OPTIONS: ReadonlyArray<{ value: SchoolYear; label: string }> = [
  { value: "", label: "Not specified" },
  { value: "1", label: "1st year" },
  { value: "2", label: "2nd year" },
  { value: "3", label: "3rd year" },
  { value: "4", label: "4th year" },
];

export function emptyStudent(): StudentDraft {
  return {
    name: "",
    email: "",
    phone: "",
    college: "",
    dorm: "",
    year: "",
    major: "",
  };
}

export function newRegistrationDraft(parentEmail = ""): RegistrationDraft {
  return {
    parent: {
      name: "",
      email: parentEmail,
      phone: "",
      parent2Name: "",
      parent2Phone: "",
      parent2Email: "",
      password: "",
      confirmPassword: "",
    },
    students: [emptyStudent()],
  };
}

type StudentDraftInput = z.input<typeof studentSchema>;

export function toStudentInput(student: StudentDraft): StudentDraftInput {
  return {
    name: student.name,
    email: student.email,
    phone: student.phone,
    college: student.college,
    dorm: student.dorm,
    year: student.year === "" ? null : Number(student.year),
    major: student.major,
  };
}

export function toRegistrationInput(draft: RegistrationDraft) {
  return {
    parent: draft.parent,
    students: draft.students.map(toStudentInput),
  };
}

export function toSignUpInput(draft: RegistrationDraft) {
  return {
    ...toRegistrationInput(draft),
    password: draft.parent.password,
    confirmPassword: draft.parent.confirmPassword,
  };
}

/** Which tab owns a given field path, so validation can jump to the problem. */
export function tabForField(path: string): "parent" | "students" {
  return path.startsWith("students.") ? "students" : "parent";
}
