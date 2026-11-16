"use client";

import { useState, type InputHTMLAttributes } from "react";
import { controlClass } from "@/components/registration/form-controls";

export function PasswordInput({ invalid, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="relative">
    <input {...props} type={visible ? "text" : "password"} aria-invalid={invalid || undefined} className={controlClass(invalid) + " pr-12"} />
    <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} aria-controls={props.id}
      onClick={() => setVisible(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
        {visible && <path d="m3 3 18 18" />}
      </svg>
    </button>
  </div>;
}
