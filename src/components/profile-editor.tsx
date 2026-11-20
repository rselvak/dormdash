"use client";

import { useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/profile/actions";
import { StudentFields } from "@/components/registration/student-fields";
import { emptyStudent, toStudentInput, type StudentDraft } from "@/lib/registration-draft";

type ProfileData = {
  name: string; email: string; phone: string; parent2Name: string | null; parent2Email: string | null; parent2Phone: string | null;
  students: { id: string; name: string; email: string; phone: string | null; college: string; dorm: string | null; year: number | null; major: string; verifyCollegeEmail?:boolean }[];
};
export function ProfileEditor({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const clerk = useClerk();
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [parent, setParent] = useState({ name: profile.name, email: profile.email, phone: profile.phone, parent2Name: profile.parent2Name || "", parent2Email: profile.parent2Email || "", parent2Phone: profile.parent2Phone || "" });
  const initialStudents = () => profile.students.map(student => ({ id: student.id, value: { ...student, phone: student.phone || "", dorm: student.dorm || "", year: student.year ? String(student.year) as StudentDraft["year"] : "" } }));
  const [students, setStudents] = useState<{ id?: string; key?: string; value: StudentDraft }[]>(initialStudents);
  if (!editing) return <div className="mt-5"><button type="button" onClick={() => { setMessage("");setParent({ name: profile.name, email: profile.email, phone: profile.phone, parent2Name: profile.parent2Name || "", parent2Email: profile.parent2Email || "", parent2Phone: profile.parent2Phone || "" });setStudents(initialStudents());setEditing(true); }} className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent">Edit profile &amp; students</button>{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>;
  return <form className="mt-5 space-y-5 rounded-xl border-2 border-accent bg-card p-4" onSubmit={async event => {
    event.preventDefault();setBusy(true);setMessage("");
    try {
      await user?.reload();
      const result = await saveProfile({ parent: { ...parent, email: user?.primaryEmailAddress?.emailAddress || parent.email }, students: students.map(student => ({ ...toStudentInput(student.value), id: student.id })) });
      setMessage(result.message);
      if (result.ok) { setEditing(false);router.refresh(); }
    } catch { setMessage("Unable to save. Please try again."); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-semibold">Edit My Profile</h2>
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      {([['name','Parent 1 name'],['phone','Parent 1 phone'],['parent2Name','Parent 2 name'],['parent2Email','Parent 2 email'],['parent2Phone','Parent 2 phone']] as const).map(([key,label]) => <label key={key} className="text-sm">{label}<input required={key==='name'||key==='phone'} type={key==='parent2Email'?'email':'text'} maxLength={120} value={parent[key]} onChange={event => setParent({ ...parent, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>)}
      <div className="text-sm"><p>Login email: {user?.primaryEmailAddress?.emailAddress || profile.email}</p><button type="button" onClick={() => clerk.openUserProfile()} className="mt-1 text-accent underline">Change login email / account name</button><p className="mt-1 text-xs text-muted">Verify your new email and make it primary in Account settings. Save this form to sync your family profile.</p></div>
    </fieldset>
    <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Students</legend>
      {students.map((student,index) => <StudentFields key={student.id || student.key} idPrefix={`edit-student-${student.id || student.key}`} index={index} value={student.value} errors={{}} errorPrefix={`students.${index}`} onChange={patch => setStudents(current => current.map((item,i) => i === index ? { ...item, value: { ...item.value, ...patch } } : item))} onRemove={() => { if(window.confirm(`Remove ${student.value.name || 'this student'} from your profile? This takes effect when you save.`))setStudents(current => current.filter((_,i) => i !== index)); }}/>)}
      <button type="button" disabled={students.length >= 10} onClick={() => setStudents([...students,{ key: crypto.randomUUID(), value: emptyStudent() }])} className="rounded-full border border-border px-4 py-2 text-sm">+ Add student</button>
    </fieldset>
    {message && <p role="alert" className="whitespace-pre-wrap text-sm text-red-700">{message}</p>}
    <div className="flex gap-3"><button disabled={busy} type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground">{busy?'Saving…':'Save profile'}</button><button disabled={busy} type="button" onClick={() => setEditing(false)} className="text-sm underline">Cancel</button></div>
  </form>;
}
