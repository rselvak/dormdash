import { describe, expect, it } from "vitest";

import {
  isValidPhone,
  normalizePhone,
  parentAccountSchema,
  registrationSchema,
  signUpFormSchema,
  toFieldErrors,
} from "@/lib/validation/registration";
import {
  emptyStudent,
  tabForField,
  toStudentInput,
} from "@/lib/registration-draft";

const validRegistration = {
  parent: {
    name: "Alex Morgan",
    email: "Alex@Example.com",
    phone: "(555) 123-4567",
    parent2Name: "",
    parent2Phone: "",
    parent2Email: "",
  },
  students: [
    {
      name: "Sam Morgan",
      email: "Sam@School.edu",
      phone: "",
      college: "Stanford University",
      dorm: "Baker Hall",
      year: 2,
      major: "Computer Science",
    },
  ],
};

function issuePaths(input: Parameters<typeof registrationSchema.safeParse>[0]) {
  const result = registrationSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("phone helpers", () => {
  it("strips formatting while keeping a leading plus", () => {
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("555.123.4567")).toBe("5551234567");
  });

  it("returns an empty string when there are no digits", () => {
    expect(normalizePhone(" ( ) ")).toBe("");
  });

  it("accepts reasonable international numbers", () => {
    expect(isValidPhone("+44 20 7946 0958")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("+1 555 12")).toBe(false);
  });
});

describe("registrationSchema", () => {
  it("normalizes emails and phones", () => {
    const result = registrationSchema.safeParse(validRegistration);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.parent.email).toBe("alex@example.com");
    expect(result.data.parent.phone).toBe("5551234567");
    expect(result.data.students[0].email).toBe("sam@school.edu");
    expect(result.data.students[0].year).toBe(2);
    expect(result.data.parent.parent2Name).toBe("");
  });

  it("treats optional student fields as empty values", () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      students: [
        {
          ...validRegistration.students[0],
          phone: "",
          dorm: "",
          year: null,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.students[0].phone).toBe("");
    expect(result.data.students[0].year).toBeNull();
  });

  it("requires all of parent 2 or none of parent 2", () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      parent: {
        ...validRegistration.parent,
        parent2Name: "Jordan Morgan",
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toHaveProperty(
      "parent.parent2Name",
      "Enter all of parent 2's details, or leave all of them blank.",
    );
  });

  it("rejects the same student email twice", () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      students: [
        validRegistration.students[0],
        { ...validRegistration.students[0], email: "sam@school.edu" },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(issuePaths({ ...validRegistration, students: [
      validRegistration.students[0],
      { ...validRegistration.students[0], email: "sam@school.edu" },
    ] })).toContain("students.1.email");
  });

  it("rejects a year outside 1 to 4", () => {
    const invalid = {
      ...validRegistration,
      students: [{ ...validRegistration.students[0], year: 5 }],
    };

    expect(issuePaths(invalid)).toContain("students.0.year");
  });

  it("requires at least one student", () => {
    expect(issuePaths({ ...validRegistration, students: [] })).toContain(
      "students",
    );
  });

  it("rejects a college that is not in the California list", () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      students: [
        { ...validRegistration.students[0], college: "State University" },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toHaveProperty(
      "students.0.college",
      "Choose a college from the list.",
    );
  });

  it("rejects a major the selected college does not offer", () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      students: [
        {
          ...validRegistration.students[0],
          major: "Underwater Basket Weaving",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toHaveProperty(
      "students.0.major",
      "Choose a major offered at Stanford University.",
    );
  });
});

describe("signUpFormSchema", () => {
  it("rejects a password mismatch", () => {
    const result = signUpFormSchema.safeParse({
      ...validRegistration,
      password: "a-good-password",
      confirmPassword: "a-different-password",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toHaveProperty(
      "confirmPassword",
      "Passwords do not match.",
    );
  });

  it("rejects short passwords", () => {
    const result = signUpFormSchema.safeParse({
      ...validRegistration,
      password: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toHaveProperty(
      "password",
      "Password must be at least 8 characters.",
    );
  });
});

describe("parentAccountSchema", () => {
  it("accepts the parent step without student data", () => {
    const result = parentAccountSchema.safeParse({
      ...validRegistration.parent,
      password: "a-good-password",
      confirmPassword: "a-good-password",
    });

    expect(result.success).toBe(true);
  });

  it("validates an optional parent 2 phone when supplied", () => {
    const result = parentAccountSchema.safeParse({
      ...validRegistration.parent,
      parent2Name: "Jordan Morgan",
      parent2Email: "jordan@example.com",
      parent2Phone: "12",
      password: "a-good-password",
      confirmPassword: "a-good-password",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toHaveProperty("parent2Phone");
  });
});

describe("registration draft", () => {
  it("converts the year string for validation", () => {
    expect(toStudentInput({ ...emptyStudent(), year: "3" }).year).toBe(3);
    expect(toStudentInput(emptyStudent()).year).toBeNull();
  });

  it("maps field paths to the tab that owns them", () => {
    expect(tabForField("parent.email")).toBe("parent");
    expect(tabForField("password")).toBe("parent");
    expect(tabForField("students.0.email")).toBe("students");
  });
});
