"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resendStudentVerification } from "@/app/profile/student-verification-actions";

export function StudentVerificationStatus({ id, enabled, verified, pending }: { id: string; enabled: boolean; verified: boolean; pending: boolean }) {
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  return <div className="mt-4 rounded-lg border border-border p-3 text-xs"><p className="font-semibold">{!enabled ? "College email verification: Off (not required)" : verified ? "College email verified" : pending ? "College email verification: Pending" : "College email verification: Not sent"}</p>{verified && <p className="mt-1 text-muted">Email access verified; current enrollment is not confirmed.</p>}{enabled&&!verified&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await resendStudentVerification(id);setMessage(result.message);router.refresh();}catch{setMessage("Unable to send verification.");}finally{setBusy(false);}}} className="mt-2 font-medium text-accent underline disabled:opacity-50">{busy?"Sending…":pending?"Resend verification email":"Send verification email"}</button>}{message&&<p role="status" className="mt-2">{message}</p>}</div>;
}
