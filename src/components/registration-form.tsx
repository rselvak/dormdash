"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  Field,
  FormBanner,
  TextInput,
} from "@/components/registration/form-controls";
import { StudentFields } from "@/components/registration/student-fields";
import { completeRegistration } from "@/app/sign-up/actions";
import {
  emptyStudent,
  newRegistrationDraft,
  tabForField,
  toRegistrationInput,
  toSignUpInput,
  type ParentDraft,
  type RegistrationDraft,
  type StudentDraft,
} from "@/lib/registration-draft";
import { cn } from "@/lib/utils";
import type { RegistrationInput } from "@/lib/validation/registration";
import {
  parentAccountSchema,
  parentProfileSchema,
  registrationSchema,
  signUpFormSchema,
  toFieldErrors,
} from "@/lib/validation/registration";

type Mode = "signup" | "onboarding";
type Tab = "parent" | "students";
type Stage = "form" | "verify" | "retry";

type RegistrationFormProps = {
  mode: Mode;
  /** Verified Clerk email, used as the locked parent email when onboarding. */
  accountEmail?: string;
};

function clerkMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const longMessage = (error as { longMessage?: unknown }).longMessage;
    if (typeof longMessage === "string" && longMessage) return longMessage;

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }

  return fallback;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function prefixParentStepErrors(errors: Record<string, string>) {
  const result: Record<string, string> = {};

  for (const [path, message] of Object.entries(errors)) {
    const isPassword = path === "password" || path === "confirmPassword";
    result[isPassword ? path : `parent.${path}`] = message;
  }

  return result;
}

export function RegistrationForm({
  mode,
  accountEmail = "",
}: RegistrationFormProps) {
  const { signUp } = useSignUp();

  const [draft, setDraft] = useState<RegistrationDraft>(() =>
    newRegistrationDraft(accountEmail),
  );
  const [tab, setTab] = useState<Tab>("parent");
  const [stage, setStage] = useState<Stage>("form");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pendingData, setPendingData] = useState<RegistrationInput | null>(
    null,
  );

  const isSignUp = mode === "signup";
  const parentEmail = isSignUp ? draft.parent.email : accountEmail;

  const errorCount = useMemo(
    () => Object.keys(fieldErrors).length,
    [fieldErrors],
  );

  function clearError(path: string) {
    setFieldErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function updateParent<K extends keyof ParentDraft>(
    key: K,
    value: ParentDraft[K],
  ) {
    setDraft((current) => ({
      ...current,
      parent: { ...current.parent, [key]: value },
    }));
    clearError(`parent.${key}`);
    clearError(key);
  }

  function updateStudent(index: number, patch: Partial<StudentDraft>) {
    setDraft((current) => ({
      ...current,
      students: current.students.map((student, studentIndex) =>
        studentIndex === index ? { ...student, ...patch } : student,
      ),
    }));

    for (const key of Object.keys(patch)) {
      clearError(`students.${index}.${key}`);
    }
  }

  function addStudent() {
    setDraft((current) =>
      current.students.length >= 10
        ? current
        : { ...current, students: [...current.students, emptyStudent()] },
    );
    setFieldErrors({});
  }

  function removeStudent(index: number) {
    setDraft((current) =>
      current.students.length <= 1
        ? current
        : {
            ...current,
            students: current.students.filter(
              (_, studentIndex) => studentIndex !== index,
            ),
          },
    );
    setFieldErrors({});
  }

  function showErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    setFormError(
      Object.keys(errors).length > 0
        ? "Please fix the highlighted fields."
        : "Please check your details.",
    );

    const firstPath = Object.keys(errors)[0];
    if (firstPath) setTab(tabForField(firstPath));
  }

  function continueToStudents() {
    const parsed = isSignUp
      ? parentAccountSchema.safeParse(draft.parent)
      : parentProfileSchema.safeParse(draft.parent);

    if (!parsed.success) {
      showErrors(prefixParentStepErrors(toFieldErrors(parsed.error)));
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setTab("students");
  }

  async function finish() {
    // A full navigation guarantees the server sees Clerk's fresh session
    // cookies after finalize() and renders the saved registration.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  async function saveRegistration(data: RegistrationInput) {
    setBusy(true);
    setFormError(null);

    const result = await completeRegistration(data);

    if (!result.ok) {
      setBusy(false);
      setFormError(result.message);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        const firstPath = Object.keys(result.fieldErrors)[0];
        if (firstPath) setTab(tabForField(firstPath));
      }
      // The Clerk account exists, so re-validating the form cannot fix a
      // database problem. Offer a safe retry instead.
      setStage("retry");
      return;
    }

    await finish();
  }

  async function submitForm() {
    const parsed = isSignUp
      ? signUpFormSchema.safeParse(toSignUpInput(draft))
      : registrationSchema.safeParse(toRegistrationInput(draft));

    if (!parsed.success) {
      showErrors(toFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setFormError(null);

    if (!isSignUp) {
      await saveRegistration(parsed.data);
      return;
    }

    if (!signUp) {
      setFormError(
        "Sign-up is still loading. Wait a moment and try again, or refresh the page.",
      );
      return;
    }

    setBusy(true);

    const { firstName, lastName } = splitName(parsed.data.parent.name);
    const emailAddress = parsed.data.parent.email;

    const { error: passwordError } = await signUp.password({
      emailAddress,
      password: draft.parent.password,
      firstName,
      lastName,
    });

    if (passwordError) {
      setBusy(false);
      setFormError(
        clerkMessage(
          passwordError,
          "We couldn't create your account. Check your details and try again.",
        ),
      );
      return;
    }

    const { error: sendError } =
      await signUp.verifications.sendEmailCode();

    if (sendError) {
      setBusy(false);
      setFormError(
        clerkMessage(
          sendError,
          "We couldn't send the verification code. Try again in a moment.",
        ),
      );
      return;
    }

    // Do not send the plaintext password to our own server action; Clerk owns
    // it. Only the profile data is needed for persistence.
    setPendingData({
      parent: parsed.data.parent,
      students: parsed.data.students,
    });
    setBusy(false);
    setCode("");
    setStage("verify");
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (tab === "parent") {
      continueToStudents();
      return;
    }

    await submitForm();
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signUp || !pendingData || busy) return;

    const trimmed = code.trim();

    if (!/^\d{6}$/.test(trimmed)) {
      setFormError("Enter the 6-digit code from your email.");
      return;
    }

    setBusy(true);
    setFormError(null);

    const { error: verifyError } =
      await signUp.verifications.verifyEmailCode({ code: trimmed });

    if (verifyError) {
      setBusy(false);
      setFormError(
        clerkMessage(
          verifyError,
          "That code didn't work. Check it and try again.",
        ),
      );
      return;
    }

    const { error: finalizeError } = await signUp.finalize();

    if (finalizeError) {
      setBusy(false);
      setFormError(
        clerkMessage(
          finalizeError,
          "Your email is verified, but we couldn't finish signing you in. Try again.",
        ),
      );
      return;
    }

    await saveRegistration(pendingData);
  }

  async function resendCode() {
    if (!signUp || busy) return;

    setBusy(true);
    setFormError(null);

    const { error } = await signUp.verifications.sendEmailCode();
    setBusy(false);

    if (error) {
      setFormError(
        clerkMessage(error, "We couldn't resend the code. Try again shortly."),
      );
    }
  }

  async function useDifferentEmail() {
    if (!signUp) return;
    await signUp.reset();
    setPendingData(null);
    setCode("");
    setFormError(null);
    setStage("form");
    setTab("parent");
  }

  async function retrySave() {
    if (!pendingData) {
      setStage("form");
      return;
    }

    await saveRegistration(pendingData);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Registration
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {isSignUp ? "Create your family account" : "Complete your registration"}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          {isSignUp
            ? "Parent 1's email is your login id. Add one or more students now, and you can always add another child later."
            : "Your account is ready. Tell us who the parent is and which students you are registering."}
        </p>
        {!isSignUp && accountEmail ? (
          <p className="mt-2 text-sm text-muted">
            Signed in as{" "}
            <span className="font-medium text-foreground">{accountEmail}</span>
          </p>
        ) : null}
      </header>

      {stage === "form" ? (
        <div
          role="tablist"
          aria-label="Registration steps"
          className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1"
        >
          <TabButton
            id="registration-tab-parent"
            controls="registration-panel-parent"
            selected={tab === "parent"}
            onClick={() => setTab("parent")}
          >
            <span className="mr-1.5 opacity-60">1</span>
            Parent & account
          </TabButton>
          <TabButton
            id="registration-tab-students"
            controls="registration-panel-students"
            selected={tab === "students"}
            onClick={() => setTab("students")}
          >
            <span className="mr-1.5 opacity-60">2</span>
            Students
            {errorCount > 0 && tab !== "students" ? (
              <span className="ml-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle" />
            ) : null}
          </TabButton>
        </div>
      ) : null}

      {formError ? (
        <div className="mt-5">
          <FormBanner>{formError}</FormBanner>
        </div>
      ) : null}

      {stage === "verify" ? (
        <form
          onSubmit={verifyCode}
          noValidate
          className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{parentEmail}</span>.
            Enter it to verify the address and finish creating your account.
          </p>

          <div className="mt-5 max-w-xs">
            <Field
              id="verification-code"
              label="Verification code"
              required
              hint="The code expires after a few minutes."
            >
              <TextInput
                id="verification-code"
                name="verification-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify and finish"}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              Resend code
            </button>
          </div>

          <button
            type="button"
            onClick={useDifferentEmail}
            disabled={busy}
            className="mt-5 text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
          >
            Use a different email address
          </button>
        </form>
      ) : null}

      {stage === "retry" ? (
        <section className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">
            Your account is ready, but the registration did not save
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            You are signed in, but we could not store your family details. Your
            information is still here, so try once more. If it keeps failing,
            sign in later and reopen this page.
          </p>
          <button
            type="button"
            onClick={retrySave}
            disabled={busy}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Try saving again"}
          </button>
        </section>
      ) : null}

      {stage === "form" ? (
        <form onSubmit={handleFormSubmit} noValidate className="mt-5">
          <section
            id="registration-panel-parent"
            role="tabpanel"
            aria-labelledby="registration-tab-parent"
            tabIndex={0}
            hidden={tab !== "parent"}
            className="focus:outline-none"
          >
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Parent details</h2>
                <p className="text-xs text-muted">1 is the primary contact</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id="parent-name"
                  label="Parent 1 name"
                  required
                  error={fieldErrors["parent.name"]}
                  className="sm:col-span-2"
                >
                  <TextInput
                    id="parent-name"
                    name="parent-name"
                    autoComplete="name"
                    value={draft.parent.name}
                    invalid={Boolean(fieldErrors["parent.name"])}
                    onChange={(event) =>
                      updateParent("name", event.target.value)
                    }
                  />
                </Field>

                <Field
                  id="parent-email"
                  label="Parent 1 email"
                  required
                  error={fieldErrors["parent.email"]}
                  hint={
                    isSignUp
                      ? "You will sign in with this email."
                      : "This is the email on your account."
                  }
                >
                  <TextInput
                    id="parent-email"
                    name="parent-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    readOnly={!isSignUp}
                    value={parentEmail}
                    invalid={Boolean(fieldErrors["parent.email"])}
                    onChange={(event) =>
                      updateParent("email", event.target.value)
                    }
                  />
                </Field>

                <Field
                  id="parent-phone"
                  label="Parent 1 phone number"
                  required
                  error={fieldErrors["parent.phone"]}
                  hint="Include the country code if you are outside the US."
                >
                  <TextInput
                    id="parent-phone"
                    name="parent-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                    value={draft.parent.phone}
                    invalid={Boolean(fieldErrors["parent.phone"])}
                    onChange={(event) =>
                      updateParent("phone", event.target.value)
                    }
                  />
                </Field>
              </div>

              <div className="mt-7 border-t border-border pt-5">
                <h3 className="text-sm font-semibold">
                  Parent 2{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Fill in all three fields, or leave all of them blank.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id="parent2-name"
                    label="Parent 2 name"
                    error={fieldErrors["parent.parent2Name"]}
                    className="sm:col-span-2"
                  >
                    <TextInput
                      id="parent2-name"
                      name="parent2-name"
                      autoComplete="off"
                      value={draft.parent.parent2Name}
                      invalid={Boolean(fieldErrors["parent.parent2Name"])}
                      onChange={(event) =>
                        updateParent("parent2Name", event.target.value)
                      }
                    />
                  </Field>

                  <Field
                    id="parent2-phone"
                    label="Parent 2 phone number"
                    error={fieldErrors["parent.parent2Phone"]}
                  >
                    <TextInput
                      id="parent2-phone"
                      name="parent2-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      value={draft.parent.parent2Phone}
                      invalid={Boolean(fieldErrors["parent.parent2Phone"])}
                      onChange={(event) =>
                        updateParent("parent2Phone", event.target.value)
                      }
                    />
                  </Field>

                  <Field
                    id="parent2-email"
                    label="Parent 2 email"
                    error={fieldErrors["parent.parent2Email"]}
                  >
                    <TextInput
                      id="parent2-email"
                      name="parent2-email"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={draft.parent.parent2Email}
                      invalid={Boolean(fieldErrors["parent.parent2Email"])}
                      onChange={(event) =>
                        updateParent("parent2Email", event.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>

              {isSignUp ? (
                <div className="mt-7 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">Account security</h3>
                  <p className="mt-1 text-xs text-muted">
                    Use at least 8 characters. You will verify the email after
                    this step.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      id="password"
                      label="Password"
                      required
                      error={fieldErrors.password}
                    >
                      <TextInput
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        value={draft.parent.password}
                        invalid={Boolean(fieldErrors.password)}
                        onChange={(event) =>
                          updateParent("password", event.target.value)
                        }
                      />
                    </Field>

                    <Field
                      id="confirm-password"
                      label="Confirm password"
                      required
                      error={fieldErrors.confirmPassword}
                    >
                      <TextInput
                        id="confirm-password"
                        name="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={draft.parent.confirmPassword}
                        invalid={Boolean(fieldErrors.confirmPassword)}
                        onChange={(event) =>
                          updateParent("confirmPassword", event.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section
            id="registration-panel-students"
            role="tabpanel"
            aria-labelledby="registration-tab-students"
            tabIndex={0}
            hidden={tab !== "students"}
            className="space-y-4 focus:outline-none"
          >
            {draft.students.map((student, index) => (
              <StudentFields
                key={index}
                idPrefix={`student-${index}`}
                index={index}
                value={student}
                errorPrefix={`students.${index}`}
                errors={fieldErrors}
                onChange={(patch) => updateStudent(index, patch)}
                onRemove={
                  draft.students.length > 1
                    ? () => removeStudent(index)
                    : undefined
                }
              />
            ))}

            <button
              type="button"
              onClick={addStudent}
              disabled={draft.students.length >= 10}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-dashed border-border bg-card px-4 text-sm font-medium transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              + Add another child
            </button>
          </section>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {tab === "students" ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab("parent");
                    setFormError(null);
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  Back to parent details
                </button>
              ) : (
                <p className="text-xs text-muted">
                  {isSignUp ? (
                    <>
                      Already registered?{" "}
                      <Link
                        href="/sign-in"
                        className="font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Sign in
                      </Link>
                    </>
                  ) : (
                    "Your email is already verified."
                  )}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {tab === "parent"
                ? "Continue to students"
                : busy
                  ? isSignUp
                    ? "Creating account…"
                    : "Saving…"
                  : isSignUp
                    ? "Create account"
                    : "Save registration"}
            </button>
          </div>

          {busy ? (
            <p role="status" className="mt-3 text-xs text-muted sm:text-right">
              {tab === "parent"
                ? "Checking your details…"
                : isSignUp
                  ? "Talking to Clerk to create your account…"
                  : "Saving your registration…"}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function TabButton({
  id,
  controls,
  selected,
  onClick,
  children,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
