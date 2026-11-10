"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventType = "COLLEGE_PICKUP"|"COLLEGE_DROP_OFF"|"CARPOOL"|"VANPOOL"|"BUSPOOL"|"PACKAGE_DELIVERY"|"ANNOUNCEMENT";
type Event = {id:string;name:string;college:string|null;startsAt:string;type:EventType;status:"DRAFT"|"PUBLISHED";isOwner:boolean;isJoined:boolean;participantCount:number;maxParticipants:number;dueAt:string|null;paymentRequired:boolean;totalCostCents:number|null;individualCostCents:number|null;};
const types: {value:EventType;label:string}[] = [
  {value:"COLLEGE_PICKUP",label:"College pickup"},{value:"COLLEGE_DROP_OFF",label:"College drop-off"},
  {value:"CARPOOL",label:"Carpool"},{value:"VANPOOL",label:"Vanpool"},
  {value:"BUSPOOL",label:"Buspool"},{value:"PACKAGE_DELIVERY",label:"Package delivery"},
  {value:"ANNOUNCEMENT",label:"Announcement"},
];
const colors:Record<EventType,string>={COLLEGE_PICKUP:"bg-blue-100 text-blue-900",COLLEGE_DROP_OFF:"bg-emerald-100 text-emerald-900",CARPOOL:"bg-violet-100 text-violet-900",VANPOOL:"bg-orange-100 text-orange-900",BUSPOOL:"bg-cyan-100 text-cyan-900",PACKAGE_DELIVERY:"bg-amber-100 text-amber-900",ANNOUNCEMENT:"bg-pink-100 text-pink-900"};
const localDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");

function toLocalInput(value:string){const d=new Date(value);return localDate(d)+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function isoWithOffset(local:string) {
  const date=new Date(local);
  if(Number.isNaN(date.getTime())) throw new Error("Invalid date or time");
  const offset=-date.getTimezoneOffset();
  const sign=offset>=0?"+":"-";
  return local+":00"+sign+String(Math.floor(Math.abs(offset)/60)).padStart(2,"0")+":"+String(Math.abs(offset)%60).padStart(2,"0");
}

async function readApi(response:Response) {
  const contentType=response.headers.get("content-type")||"";
  if (!contentType.includes("application/json")) {
    throw new Error(response.status===404 ? "Events API was not found. Restart the development server." : `Events service returned an unexpected response (HTTP ${response.status}). Check your Next.js terminal for errors.`);
  }
  const data=await response.json();
  if (!response.ok) throw new Error(data.error||`Events request failed (HTTP ${response.status})`);
  return data;
}

export function EventsCalendar() {
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [events,setEvents]=useState<Event[]>([]);
  const [published,setPublished]=useState<Event[]>([]);
  const [colleges,setColleges]=useState<string[]>([]);
  const [college,setCollege]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [detail,setDetail]=useState<Event|null>(null);
  const [students,setStudents]=useState<{id:string;name:string;email:string;college:string}[]>([]);
  const [studentId,setStudentId]=useState("");
  const [editing,setEditing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [panelError,setPanelError]=useState("");
  const [name,setName]=useState("");
  const [dateTime,setDateTime]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [type,setType]=useState<EventType>("COLLEGE_PICKUP");
  const [status,setStatus]=useState<"DRAFT"|"PUBLISHED">("DRAFT");
  const [paymentRequired,setPaymentRequired]=useState(false);
  const [totalCost,setTotalCost]=useState("");
  const [individualCost,setIndividualCost]=useState("");
  const [maxParticipants,setMaxParticipants]=useState("4");
  const [now,setNow]=useState(()=>Date.now());
  const monthStart=new Date(month.getFullYear(),month.getMonth(),1);
  const nextMonth=new Date(month.getFullYear(),month.getMonth()+1,1);
  const monthStartIso=monthStart.toISOString();
  const nextMonthIso=nextMonth.toISOString();
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const params=new URLSearchParams({start:monthStartIso,end:nextMonthIso});
      const res=await fetch("/api/events?"+params,{cache:"no-store"});
      const body=await readApi(res);
      setEvents(body.events);
      setColleges(body.colleges||[]);
      setCollege(current=>current || body.colleges?.[0] || "");
      const publishedResponse=await fetch("/api/events?published=upcoming",{cache:"no-store"});
      const publishedBody=await readApi(publishedResponse);
      setPublished(publishedBody.events);
    } catch(e) {setError(e instanceof Error?e.message:"Could not load events");}
    finally {setLoading(false);}
  },[monthStartIso,nextMonthIso]);
  useEffect(()=>{
    // Schedule asynchronous loading rather than synchronously updating state in an effect.
    void Promise.resolve().then(load);
  },[load]);
  const openEvent=useCallback(async(id:string)=>{
    setNow(Date.now());setActiveId(id);setSelected(null);setPanelError("");setEditing(false);setDetail(null);
    try {const data=await readApi(await fetch(`/api/events/${encodeURIComponent(id)}`,{cache:"no-store"}));setDetail(data.event);setStudents(data.students);setStudentId(data.event.selectedStudentId||"");setName(data.event.name);setCollege(data.event.college||"");setType(data.event.type);setStatus(data.event.status);setMaxParticipants(String(data.event.maxParticipants));setDateTime(toLocalInput(data.event.startsAt));setDueAt(data.event.dueAt?toLocalInput(data.event.dueAt):"");}catch(e){setPanelError(e instanceof Error?e.message:"Unable to open event");}
  },[]);
  async function joinEvent(){if(!activeId)return;setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:studentId||null})}));await load();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to join");}finally{setBusy(false);}}
  async function updateEvent(e:React.FormEvent){e.preventDefault();if(!activeId)return;setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,college,type,status,maxParticipants:Number(maxParticipants),startsAt:isoWithOffset(dateTime),dueAt:dueAt?isoWithOffset(dueAt):null})}));await load();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to update");}finally{setBusy(false);}}
  const grouped=useMemo(()=>{
    const result:Record<string,Event[]>={};
    for(const event of events) {
      const key=localDate(new Date(event.startsAt));
      (result[key]??=[]).push(event);
    }
    return result;
  },[events]);
  const cells=Array.from({length:Math.ceil((monthStart.getDay()+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7},(_,i)=>i-monthStart.getDay()+1);
  function open(day:number) {
    openForDate(localDate(new Date(month.getFullYear(),month.getMonth(),day)));
  }
  function openForDate(d:string) {
    setActiveId(null);setDetail(null);setSelected(d);setCollege(colleges[0]||"");setDateTime(d+"T09:00");setDueAt("");setName("");setPaymentRequired(false);setTotalCost("");setIndividualCost("");setStatus("DRAFT");setType("COLLEGE_PICKUP");setMaxParticipants("4");setError("");
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError("");
    try {
      const body={
        name,college,type,status,paymentRequired,maxParticipants:Number(maxParticipants),
        startsAt:isoWithOffset(dateTime),
        dueAt:dueAt?isoWithOffset(dueAt):null,
        timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
        totalCostCents:paymentRequired&&totalCost!==""?Math.round(Number(totalCost)*100):null,
        individualCostCents:paymentRequired&&individualCost!==""?Math.round(Number(individualCost)*100):null,
      };
      const res=await fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      await readApi(res);
      setSelected(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to create event");}
    finally{setSaving(false);}
  }
  return <section className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Shared events calendar">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Family travel calendar</h2><p className="text-sm text-muted">Published events are shared. Your drafts are private.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" onClick={()=>{const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1));openForDate(localDate(now));}}>+ Create Event</button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Today</button>
        <button type="button" aria-label="Previous month" className="rounded-lg border border-border px-3 py-2" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button>
        <button type="button" aria-label="Next month" className="rounded-lg border border-border px-3 py-2" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button>
      </div>
    </div>
    <h3 className="mb-3 font-semibold">{month.toLocaleString("en-US",{month:"long",year:"numeric"})}</h3>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d}>{d}</div>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">
      {cells.map((day,i)=>{
        const valid=day>0&&day<=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
        const key=valid?localDate(new Date(month.getFullYear(),month.getMonth(),day)):"";
        return <button key={i} type="button" disabled={!valid} onClick={()=>open(day)} className="min-h-20 rounded-lg border border-border p-1 text-left align-top hover:border-accent disabled:opacity-20 sm:min-h-28 sm:p-2" aria-label={valid?"Create event on "+key:undefined}>
          {valid&&<><span className="text-xs font-semibold">{day}</span><div className="mt-1 space-y-1">{(grouped[key]||[]).slice(0,3).map(ev=><span key={ev.id} role="button" tabIndex={0} onClick={e=>{e.stopPropagation();void openEvent(ev.id)}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();void openEvent(ev.id)}}} className={"block cursor-pointer truncate rounded px-1 py-0.5 text-[10px] sm:text-xs "+colors[ev.type]} title={"View "+ev.name}>{ev.status==="DRAFT"?"🔒 ":""}{ev.name}</span>)}</div></>}
        </button>;
      })}
    </div>
    {loading&&<p className="mt-3 text-sm text-muted">Loading events…</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <section className="mt-8" aria-label="Upcoming published events">
      <h3 className="text-lg font-semibold">Upcoming published events</h3>
      {published.length===0&&!loading&&!error&&<p className="mt-2 text-sm text-muted">No upcoming published events yet.</p>}
      <div className="mt-3 grid gap-2">{published.map(ev=><button type="button" onClick={()=>void openEvent(ev.id)} key={ev.id} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-left hover:border-accent"><div><p className="font-medium">{ev.name}</p><p className="text-xs text-muted">{ev.college} · {types.find(t=>t.value===ev.type)?.label} · {new Date(ev.startsAt).toLocaleString()}</p></div><span className={"rounded px-2 py-1 text-xs "+colors[ev.type]}>Published</span></button>)}</div>
    </section>
    {activeId&&<div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={e=>{if(e.target===e.currentTarget)setActiveId(null)}}><aside role="dialog" aria-modal="true" aria-label="Event details" className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Event details</h2><button type="button" aria-label="Close event details" onClick={()=>setActiveId(null)}>✕</button></div>
      {panelError&&<p role="alert" className="mt-4 text-sm text-red-600">{panelError}</p>}
      {!detail&&!panelError&&<p className="mt-4 text-muted">Loading event…</p>}
      {detail&&<div className="mt-6 space-y-5">
        <div><h3 className="text-2xl font-semibold">{detail.name}</h3><p className="mt-1 text-sm text-muted">{detail.college||"College not assigned"} · {types.find(t=>t.value===detail.type)?.label} · {new Date(detail.startsAt).toLocaleString()}</p><p className="text-sm text-muted">{detail.status==="DRAFT"?"Private draft":"Published event"}</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted">Participating</p><p className="text-2xl font-semibold">{detail.participantCount}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted">Slots left</p><p className="text-2xl font-semibold">{Math.max(0,detail.maxParticipants-detail.participantCount)}</p><p className="text-xs text-muted">of {detail.maxParticipants} total</p></div></div>
        <p className="text-sm">{detail.dueAt?new Date(detail.dueAt).getTime()>now?`${Math.ceil((new Date(detail.dueAt).getTime()-now)/86400000)} day(s) left to join · Deadline ${new Date(detail.dueAt).toLocaleString()}`:"Joining deadline passed":`No separate joining deadline · Event starts ${new Date(detail.startsAt).toLocaleString()}`}</p>
        {detail.paymentRequired&&<p className="text-sm">Payment required {detail.individualCostCents!=null?`· ${(detail.individualCostCents/100).toFixed(2)} per participant`:""}</p>}
        {detail.isJoined&&<p className="text-sm font-medium text-emerald-700">✓ You are participating{detail.isOwner?" (event creator)":""}</p>}
        {!detail.isJoined&&detail.status==="PUBLISHED"&&<div><label className="block text-sm">Student (optional)<select className="mt-1 w-full rounded-lg border bg-background p-2" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">No student selected</option>{students.filter(s=>s.college.trim().toLowerCase()===detail.college?.trim().toLowerCase()).map(s=><option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}</select></label><button type="button" disabled={busy||detail.participantCount>=detail.maxParticipants||new Date(detail.startsAt).getTime()<=now||!!(detail.dueAt&&new Date(detail.dueAt).getTime()<=now)} onClick={()=>void joinEvent()} className="mt-3 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40">{busy?"Joining…":"Join event"}</button></div>}
        <a className="inline-flex rounded-full border px-4 py-2 text-sm font-medium" href={`/api/events/${encodeURIComponent(activeId)}/export`}>Download Excel (.xlsx)</a>
        {detail.isOwner&&<div><button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={()=>setEditing(v=>!v)}>{editing?"Cancel editing":"Edit event"}</button>{editing&&<form className="mt-4 grid gap-3" onSubmit={updateEvent}><label className="text-sm">Name<input className="mt-1 w-full rounded-lg border bg-background p-2" required value={name} onChange={e=>setName(e.target.value)}/></label><label className="text-sm">College<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={college} onChange={e=>setCollege(e.target.value)}><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className="text-sm">Type<select className="mt-1 w-full rounded-lg border bg-background p-2" value={type} onChange={e=>setType(e.target.value as EventType)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label className="text-sm">Starts<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" required value={dateTime} onChange={e=>setDateTime(e.target.value)}/></label><label className="text-sm">Join by<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label><label className="text-sm">Capacity<input className="mt-1 w-full rounded-lg border bg-background p-2" type="number" min="1" required value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)}/></label><label className="text-sm">Visibility<select className="mt-1 w-full rounded-lg border bg-background p-2" value={status} onChange={e=>setStatus(e.target.value as "DRAFT"|"PUBLISHED")}><option value="DRAFT">Private draft</option><option value="PUBLISHED">Published</option></select></label><button disabled={busy} className="rounded-full bg-accent px-4 py-2 text-accent-foreground">{busy?"Saving…":"Save changes"}</button></form>}</div>}
      </div>}
    </aside></div>}
    {selected&&<div className="mt-6 rounded-xl border border-border p-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Create event · {selected}</h3><button type="button" onClick={()=>setSelected(null)} aria-label="Close event form">✕</button></div>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Event name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">College<select required value={college} onChange={e=>setCollege(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Event type<select value={type} onChange={e=>setType(e.target.value as EventType)} className="mt-1 w-full rounded-lg border border-border bg-background p-2">{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Event date and time<input required type="datetime-local" value={dateTime} onChange={e=>setDateTime(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">Due date and time (optional)<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">Max participants<input required type="number" min={1} max={10000} value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">Visibility<select value={status} onChange={e=>setStatus(e.target.value as "DRAFT"|"PUBLISHED")} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="DRAFT">Draft (private)</option><option value="PUBLISHED">Published (shared)</option></select></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={paymentRequired} onChange={e=>setPaymentRequired(e.target.checked)}/> Payment required</label>
        {paymentRequired&&<><label className="text-sm">Total cost ($)<input type="number" min={0} step=".01" value={totalCost} onChange={e=>setTotalCost(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label><label className="text-sm">Individual cost ($)<input type="number" min={0} step=".01" value={individualCost} onChange={e=>setIndividualCost(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label></>}
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">{saving?"Saving…":"Create event"}</button></div>
      </form>
    </div>}
  </section>;
}
