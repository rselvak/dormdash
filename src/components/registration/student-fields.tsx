"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { COLLEGE_OPTIONS, getCollege } from "@/lib/colleges";
import {
  YEAR_OPTIONS,
  type StudentDraft,
} from "@/lib/registration-draft";
import { Combobox } from "@/components/registration/combobox";
import {
  Field,
  SelectInput,
  TextInput,
} from "@/components/registration/form-controls";

type StudentFieldsProps = {
  idPrefix: string;
  index: number;
  value: StudentDraft;
  /** Dot-separated prefix used to look up errors, e.g. `students.0`. */
  errorPrefix: string;
  errors: Record<string, string>;
  onChange: (patch: Partial<StudentDraft>) => void;
  onRemove?: () => void;
  className?: string;
};

export function StudentFields({
  idPrefix,
  index,
  value,
  errorPrefix,
  errors,
  onChange,
  onRemove,
  className,
}: StudentFieldsProps) {
  const error = (field: keyof StudentDraft) => errors[`${errorPrefix}.${field}`];

  const college = getCollege(value.college);
  const majorOptions = useMemo(
    () =>
      (college?.majors ?? []).map((major) => ({
        value: major,
        label: major,
      })),
    [college],
  );

  return (
    <fieldset
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <legend className="sr-only">Student {index + 1}</legend>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p aria-hidden className="text-sm font-semibold">
          {index === 0 ? "Student" : `Student ${index + 1}`}
        </p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-red-600 hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-name`}
          label="Student name"
          required
          error={error("name")}
          className="sm:col-span-2"
        >
          <TextInput
            id={`${idPrefix}-name`}
            name={`${idPrefix}-name`}
            autoComplete="name"
            value={value.name}
            invalid={Boolean(error("name"))}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>

        <Field
          id={`${idPrefix}-email`}
          label="Student email"
          required
          error={error("email")}
        >
          <TextInput
            id={`${idPrefix}-email`}
            name={`${idPrefix}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={value.email}
            invalid={Boolean(error("email"))}
            onChange={(event) => onChange({ email: event.target.value })}
          />
        </Field>

        <Field
          id={`${idPrefix}-phone`}
          label="Student phone"
          error={error("phone")}
          hint="Optional"
        >
          <TextInput
            id={`${idPrefix}-phone`}
            name={`${idPrefix}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            value={value.phone}
            invalid={Boolean(error("phone"))}
            onChange={(event) => onChange({ phone: event.target.value })}
          />
        </Field>

        <Field
          id={`${idPrefix}-college`}
          label="College"
          required
          error={error("college")}
          hint="Search California colleges and universities."
          className="sm:col-span-2"
        >
          <Combobox
            id={`${idPrefix}-college`}
            name={`${idPrefix}-college`}
            value={value.college}
            options={COLLEGE_OPTIONS}
            invalid={Boolean(error("college"))}
            placeholder="Start typing a college name"
            emptyMessage="No California college matches that search."
            onChange={(collegeName) =>
              onChange({ college: collegeName, major: "" })
            }
          />
        </Field>

        <Field id={`${idPrefix}-dorm`} label="Dorm name" error={error("dorm")}>
          <TextInput
            id={`${idPrefix}-dorm`}
            name={`${idPrefix}-dorm`}
            value={value.dorm}
            invalid={Boolean(error("dorm"))}
            onChange={(event) => onChange({ dorm: event.target.value })}
          />
        </Field>

        <Field
          id={`${idPrefix}-year`}
          label="Year of college"
          error={error("year")}
        >
          <SelectInput
            id={`${idPrefix}-year`}
            name={`${idPrefix}-year`}
            value={value.year}
            invalid={Boolean(error("year"))}
            options={YEAR_OPTIONS}
            onChange={(event) =>
              onChange({ year: event.target.value as StudentDraft["year"] })
            }
          />
        </Field>

        <Field
          id={`${idPrefix}-major`}
          label="Major"
          required
          error={error("major")}
          hint={
            college
              ? `${college.majors.length} majors offered at ${college.name}.`
              : "Choose a college to see the majors it offers."
          }
          className="sm:col-span-2"
        >
          <Combobox
            id={`${idPrefix}-major`}
            name={`${idPrefix}-major`}
            value={value.major}
            options={majorOptions}
            disabled={!college}
            invalid={Boolean(error("major"))}
            placeholder={
              college ? "Start typing a major" : "Choose a college first"
            }
            emptyMessage="No major at this college matches that search."
            onChange={(major) => onChange({ major })}
          />
        </Field>
      </div>
    </fieldset>
  );
}
