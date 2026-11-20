"use client";

import { useState } from "react";
import { verifyStudentEmail } from "@/app/verify-student-email/actions";

export function ConfirmStudentEmail({ token }: { token: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return <div className="space-y-4"><p className="text-sm text-muted">Confirm that you control the college email address that received this link. This verifies email access, not current enrollment.</p>{result && <p role="status" className="text-sm">{result.message}</p>}{!result?.ok && <button type="button" disabled={busy} onClick={async () => { setBusy(true);try {setResult(await verifyStudentEmail(token));}finally{setBusy(false);} }} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">{busy ? "Verifying…" : "Verify my college email"}</button>}</div>;
}
