"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { addChild } from "@/app/dashboard/students/actions";
import { FormBanner } from "@/components/registration/form-controls";
import { StudentFields } from "@/components/registration/student-fields";
import {
  emptyStudent,
  toStudentInput,
  type StudentDraft,
} from "@/lib/registration-draft";
import {
  singleStudentFormSchema,
  toFieldErrors,
} from "@/lib/validation/registration";

export function AddChildForm() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentDraft>(emptyStudent);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(patch: Partial<StudentDraft>) {
    setStudent((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) {
        delete next[`student.${key}`];
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const parsed = singleStudentFormSchema.safeParse({
      student: toStudentInput(student),
    });

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setErrors({});
    setFormError(null);
    setBusy(true);

    const result = await addChild(parsed.data);

    if (!result.ok) {
      setBusy(false);
      setFormError(result.message);
      if (result.fieldErrors) setErrors(result.fieldErrors);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError ? (
        <div className="mb-4">
          <FormBanner>{formError}</FormBanner>
        </div>
      ) : null}

      <StudentFields
        idPrefix="student-new"
        index={0}
        value={student}
        errorPrefix="student"
        errors={errors}
        onChange={update}
      />

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add student"}
        </button>
      </div>
    </form>
  );
}
