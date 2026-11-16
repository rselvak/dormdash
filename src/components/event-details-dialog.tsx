"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DormSelect } from "@/components/dorm-select";
import { EventColorPicker } from "@/components/event-color-picker";
import { getCollegeMajors } from "@/lib/colleges";
import { eventColorStyle } from "@/lib/event-color";
import { type CalendarEvent as Event, type EventType, eventTypes as types, toLocalInput, scheduleInput, eventDateLabel, eventDay, readApi } from "@/lib/event-ui";

export function EventDetailsDialog({ eventId: activeId, colleges, onClose, onChanged }: { eventId: string; colleges: string[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [detail,setDetail]=useState<Event|null>(null);
  const [students,setStudents]=useState<{id:string;name:string;email:string;college:string}[]>([]);
  const [studentId,setStudentId]=useState("");
  const [editing,setEditing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [panelError,setPanelError]=useState("");
  const [name,setName]=useState("");
  const [college,setCollege]=useState("");
  const [dorm,setDorm]=useState("");
  const [major,setMajor]=useState("");
  const majorOptions=useMemo(()=>getCollegeMajors(college),[college]);
  const [eventColor,setEventColor]=useState("#2563eb");
  const [type,setType]=useState<EventType>("COLLEGE_PICKUP");
  const [status,setStatus]=useState<"DRAFT"|"PUBLISHED">("DRAFT");
  const [maxParticipants,setMaxParticipants]=useState("4");
  const [waitingListAllowed,setWaitingListAllowed]=useState(false);
  const [maxWaitingList,setMaxWaitingList]=useState("");
  const [allDay,setAllDay]=useState(false);
  const [dateTime,setDateTime]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [now,setNow]=useState(()=>Date.now());
  const dialogRef=useRef<HTMLElement>(null);
  const openEvent=useCallback(async(id:string)=>{
    try {const data=await readApi(await fetch(`/api/events/${encodeURIComponent(id)}`,{cache:"no-store"}));setNow(Date.now());setPanelError("");setEditing(false);setDetail(data.event);setStudents(data.students);setStudentId(data.event.selectedStudentId||"");setName(data.event.name);setEventColor(eventColorStyle(data.event.color,data.event.type).backgroundColor);setDorm(data.event.dorm||"");setMajor(data.event.major||"");setCollege(data.event.college||"");setType(data.event.type);setStatus(data.event.status);setMaxParticipants(String(data.event.maxParticipants));setWaitingListAllowed(data.event.waitingListAllowed);setMaxWaitingList(data.event.maxWaitingList==null?"":String(data.event.maxWaitingList));setAllDay(data.event.allDay);setDateTime(data.event.allDay?eventDay(data.event)+"T00:00":toLocalInput(data.event.startsAt));setDueAt(data.event.dueAt?toLocalInput(data.event.dueAt):"");}catch(e){setPanelError(e instanceof Error?e.message:"Unable to open event");}
  },[]);

  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled)return openEvent(activeId)});
    return ()=>{cancelled=true};
  },[activeId,openEvent]);
  useEffect(()=>{
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    dialogRef.current?.focus();
    return ()=>{document.body.style.overflow=overflow;if(trigger?.isConnected)trigger.focus()};
  },[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return ()=>window.clearInterval(timer)},[]);
  async function joinEvent(){if(!activeId)return;if(!studentId){setPanelError("Select a student before joining.");return;}setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId})}));await onChanged();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to join");}finally{setBusy(false);}}
  async function withdrawEvent(){if(!activeId)return;setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"DELETE"}));await onChanged();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to withdraw");}finally{setBusy(false);}}
  async function updateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;

    setBusy(true);
    setPanelError("");

    try {
      await readApi(
        await fetch(`/api/events/${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,color:eventColor,
            college,
            dorm: dorm.trim() || null,
            major: major.trim() || null,
            type,
            status,
            maxParticipants: Number(maxParticipants),
            waitingListAllowed,maxWaitingList:waitingListAllowed&&maxWaitingList!==""?Number(maxWaitingList):null,
            ...scheduleInput(dateTime,allDay,dueAt),
            timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        })
      );

      await onChanged();
      await openEvent(activeId);
    } catch (e) {
      setPanelError(
        e instanceof Error ? e.message : "Unable to update"
      );
    } finally {
      setBusy(false);
    }
  }

  return (<div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside ref={dialogRef} tabIndex={-1} onKeyDown={event=>{
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.key!=="Tab")return;
    const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===event.currentTarget)){event.preventDefault();first?.focus()}
  }} role="dialog" aria-modal="true" aria-label="Event details" className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Event details</h2><button type="button" aria-label="Close event details" onClick={()=>onClose()}>Close</button></div>
      {panelError&&<p role="alert" className="mt-4 text-sm text-red-600">{panelError}</p>}
      {!detail&&!panelError&&<p className="mt-4 text-muted">Loading event...</p>}
      {detail&&<div className="mt-6 space-y-5">
        <div><h3 className="text-2xl font-semibold">{detail.name}</h3><p className="mt-1 text-sm text-muted">{detail.college||"College not assigned"}  |  {types.find(t=>t.value===detail.type)?.label}  |  {eventDateLabel(detail)}</p><p className="text-sm text-muted">{[detail.dorm&&"Dorm: "+detail.dorm,detail.major&&"Major: "+detail.major].filter(Boolean).join("  |  ")}</p><p className="text-sm text-muted">{detail.status==="DRAFT"?"Private draft":"Published event"}</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted">Participating</p><p className="text-2xl font-semibold">{detail.participantCount}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted">Slots left</p><p className="text-2xl font-semibold">{Math.max(0,detail.maxParticipants-detail.participantCount)}</p><p className="text-xs text-muted">of {detail.maxParticipants} total</p></div></div>
        <p className="text-sm">{detail.allDay?"All-day event — join before the day ends":detail.dueAt?new Date(detail.dueAt).getTime()>now?`${Math.ceil((new Date(detail.dueAt).getTime()-now)/86400000)} day(s) left to join  |  Deadline ${new Date(detail.dueAt).toLocaleString()}`:"Joining deadline passed":`No separate joining deadline  |  Event starts ${new Date(detail.startsAt).toLocaleString()}`}</p>
        {detail.paymentRequired&&<p className="text-sm">Payment required {detail.individualCostCents!=null?` |  ${(detail.individualCostCents/100).toFixed(2)} per participant`:""}</p>}
        {detail.waitingListAllowed&&<p className="text-sm">Waiting list: {detail.waitingListCount}{detail.maxWaitingList==null?" (no limit)":` / ${detail.maxWaitingList}`}</p>}
        {detail.isJoined&&<div className="space-y-2"><p className="text-sm font-medium">{detail.participationStatus==="WAITLISTED"?"You are on the waiting list":"Confirmed: You are participating"}</p>{detail.joinedAt&&<p className="text-xs text-muted">Responded {new Date(detail.joinedAt).toLocaleString()}</p>}<button type="button" disabled={busy} onClick={()=>void withdrawEvent()} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">{busy?"Withdrawing...":detail.participationStatus==="WAITLISTED"?"Leave waiting list":"Withdraw from event"}</button></div>}
        {!detail.isJoined&&detail.status==="PUBLISHED"&&<div><label className="block text-sm">Student *<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select a student</option>{students.filter(s=>s.college.trim().toLowerCase()===detail.college?.trim().toLowerCase()).map(s=><option key={s.id} value={s.id}>{s.name}  -  {s.email}</option>)}</select></label><button type="button" disabled={busy||!studentId||(detail.participantCount>=detail.maxParticipants&&(!detail.waitingListAllowed||(detail.maxWaitingList!=null&&detail.waitingListCount>=detail.maxWaitingList)))||new Date(detail.allDay&&detail.endsAt?detail.endsAt:detail.startsAt).getTime()<=now||!!(detail.dueAt&&new Date(detail.dueAt).getTime()<=now)} onClick={()=>void joinEvent()} className="mt-3 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40">{busy?"Joining...":detail.participantCount>=detail.maxParticipants?"Join waiting list":"Join event"}</button></div>}
        <a className="inline-flex rounded-full border px-4 py-2 text-sm font-medium" href={`/api/events/${encodeURIComponent(activeId)}/export`}>Download Excel (.xlsx)</a>
        {detail.isOwner&&<div><button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={()=>setEditing(v=>!v)}>{editing?"Cancel editing":"Edit event"}</button>{editing&&<form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={updateEvent}>
        <label className="text-sm">Event type *<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={type} onChange={e=>setType(e.target.value as EventType)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Name<input className="mt-1 w-full rounded-lg border bg-background p-2" required value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="text-sm">College *<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={college} onChange={e=>{setCollege(e.target.value);setDorm("");setMajor("")}}><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Major (optional)<select disabled={!college} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 disabled:opacity-50"><option value="">{college?"All majors":"Choose a college first"}</option>{major&&!majorOptions.includes(major)&&<option value={major}>{major} (previously saved)</option>}{majorOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        <EventColorPicker value={eventColor} onChange={setEventColor}/>
        <div className="sm:col-span-2"><DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm (optional)" inlineOther/></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/> All day event</label>
        {!allDay&&<>
        <label className="text-sm">Starts<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" required value={dateTime} onChange={e=>setDateTime(e.target.value)}/></label>
        <label className="text-sm">Join by<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
        </>}
        <label className="text-sm">Max participants *<input className="mt-1 w-full rounded-lg border bg-background p-2" type="number" min="1" required value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)}/></label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={waitingListAllowed} onChange={e=>setWaitingListAllowed(e.target.checked)}/> Is Waiting List Allowed</label>
        {waitingListAllowed&&<label className="text-sm">Max Number in Waiting List (optional)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={maxWaitingList} onChange={e=>{if(/^\d*$/.test(e.target.value))setMaxWaitingList(e.target.value)}} className="mt-1 w-full rounded-lg border bg-background p-2"/><span className="mt-1 block text-xs text-muted">Leave blank for no limit.</span></label>}<label className="text-sm">Visibility<select className="mt-1 w-full rounded-lg border bg-background p-2" value={status} onChange={e=>setStatus(e.target.value as "DRAFT"|"PUBLISHED")}><option value="DRAFT">Private draft</option><option value="PUBLISHED">Published</option></select></label><button disabled={busy} className="rounded-full bg-accent px-4 py-2 text-accent-foreground">{busy?"Saving...":"Save changes"}</button></form>}</div>}
      </div>}
    </aside></div>);
}
