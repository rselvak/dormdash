"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DormSelect } from "@/components/dorm-select";
import { getCollegeMajors } from "@/lib/colleges";

import { EventColorPicker } from "@/components/event-color-picker";
import { eventColorStyle } from "@/lib/event-color";

type EventType = "COLLEGE_PICKUP"|"COLLEGE_DROP_OFF"|"CARPOOL"|"VANPOOL"|"BUSPOOL"|"PACKAGE_DELIVERY"|"ANNOUNCEMENT";
type Event = {color:string|null;waitingListAllowed:boolean;maxWaitingList:number|null;waitingListCount:number;participationStatus:"ACCEPTED"|"WAITLISTED"|null;joinedAt:string|null;id:string;name:string;college:string|null;dorm:string|null;major:string|null;startsAt:string;type:EventType;status:"DRAFT"|"PUBLISHED";isOwner:boolean;isJoined:boolean;participantCount:number;maxParticipants:number;dueAt:string|null;paymentRequired:boolean;totalCostCents:number|null;individualCostCents:number|null;};
const types: {value:EventType;label:string}[] = [
  {value:"COLLEGE_PICKUP",label:"College pickup"},{value:"COLLEGE_DROP_OFF",label:"College drop-off"},
  {value:"CARPOOL",label:"Carpool"},{value:"VANPOOL",label:"Vanpool"},
  {value:"BUSPOOL",label:"Buspool"},{value:"PACKAGE_DELIVERY",label:"Package delivery"},
  {value:"ANNOUNCEMENT",label:"Announcement"},
];
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
  const [eventColor,setEventColor]=useState("#2563eb");
  const [name,setName]=useState("");
  const [dorm,setDorm]=useState("");
  const [major,setMajor]=useState("");
  const majorOptions=useMemo(()=>getCollegeMajors(college),[college]);
  const [dateTime,setDateTime]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [type,setType]=useState<EventType>("COLLEGE_PICKUP");
  const [status,setStatus]=useState<"DRAFT"|"PUBLISHED">("DRAFT");
  const [paymentRequired,setPaymentRequired]=useState(false);
  const [totalCost,setTotalCost]=useState("");
  const [individualCost,setIndividualCost]=useState("");
  const [maxParticipants,setMaxParticipants]=useState("4");
  const [waitingListAllowed,setWaitingListAllowed]=useState(false);
  const [maxWaitingList,setMaxWaitingList]=useState("");
  const [now,setNow]=useState(()=>Date.now());
  const monthStart=new Date(month.getFullYear(),month.getMonth(),1);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const start=new Date(month.getFullYear(),month.getMonth(),1).toISOString();
      const end=new Date(month.getFullYear(),month.getMonth()+1,1).toISOString();
      const params=new URLSearchParams({start,end});
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
  },[month]);
  useEffect(()=>{void Promise.resolve().then(load)},[load]);
  const openEvent=useCallback(async(id:string)=>{
    setNow(Date.now());setActiveId(id);setSelected(null);setPanelError("");setEditing(false);setDetail(null);
    try {const data=await readApi(await fetch(`/api/events/${encodeURIComponent(id)}`,{cache:"no-store"}));setDetail(data.event);setStudents(data.students);setStudentId(data.event.selectedStudentId||"");setName(data.event.name);setEventColor(eventColorStyle(data.event.color,data.event.type).backgroundColor);setDorm(data.event.dorm||"");setMajor(data.event.major||"");setCollege(data.event.college||"");setType(data.event.type);setStatus(data.event.status);setMaxParticipants(String(data.event.maxParticipants));setWaitingListAllowed(data.event.waitingListAllowed);setMaxWaitingList(data.event.maxWaitingList==null?"":String(data.event.maxWaitingList));setDateTime(toLocalInput(data.event.startsAt));setDueAt(data.event.dueAt?toLocalInput(data.event.dueAt):"");}catch(e){setPanelError(e instanceof Error?e.message:"Unable to open event");}
  },[]);
  async function joinEvent(){if(!activeId)return;setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:studentId||null})}));await load();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to join");}finally{setBusy(false);}}
  async function withdrawEvent(){if(!activeId)return;setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"DELETE"}));await load();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to withdraw");}finally{setBusy(false);}}
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
            startsAt: isoWithOffset(dateTime),
            dueAt: dueAt ? isoWithOffset(dueAt) : null,
          }),
        })
      );

      await load();
      await openEvent(activeId);
    } catch (e) {
      setPanelError(
        e instanceof Error ? e.message : "Unable to update"
      );
    } finally {
      setBusy(false);
    }
  }
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
    setActiveId(null);setDetail(null);setSelected(d);setCollege(colleges[0]||"");setDateTime(d+"T09:00");setDueAt("");setName("");setEventColor("#2563eb");setDorm("");setMajor("");setPaymentRequired(false);setTotalCost("");setIndividualCost("");setStatus("DRAFT");setType("COLLEGE_PICKUP");setMaxParticipants("4");setWaitingListAllowed(false);setMaxWaitingList("");setError("");
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError("");
    try {
      const body={
        waitingListAllowed,maxWaitingList:waitingListAllowed&&maxWaitingList!==""?Number(maxWaitingList):null,
        name,color:eventColor,college,dorm:dorm.trim()||null,major:major.trim()||null,type,status,paymentRequired,maxParticipants:Number(maxParticipants),
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
  return <section className="mt-8 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-card to-sky-50/60 p-4 dark:border-indigo-800 dark:from-indigo-950/30 dark:to-sky-950/20 sm:p-6" aria-label="Shared events calendar">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">DormDash Calendar</h2><p className="text-sm text-muted">Published events are shared. Your drafts are private.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" onClick={()=>{const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1));openForDate(localDate(now));}}>+ Create Event</button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Today</button>
        <button type="button" aria-label="Previous month" className="rounded-lg border border-border px-3 py-2" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>Previous</button>
        <button type="button" aria-label="Next month" className="rounded-lg border border-border px-3 py-2" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>Next</button>
      </div>
    </div>
    <h3 className="mb-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 font-semibold text-white">{month.toLocaleString("en-US",{month:"long",year:"numeric"})}</h3>
    <div className="grid grid-cols-7 gap-1 rounded-lg bg-indigo-100/80 py-2 text-center text-xs font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d}>{d}</div>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">
      {cells.map((day,i)=>{
        const valid=day>0&&day<=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
        const key=valid?localDate(new Date(month.getFullYear(),month.getMonth(),day)):"";
        return <button key={i} type="button" disabled={!valid} onClick={()=>open(day)} className={"min-h-20 rounded-lg border p-1 text-left align-top transition-colors hover:border-accent hover:bg-indigo-100/60 disabled:opacity-20 dark:hover:bg-indigo-950/50 sm:min-h-28 sm:p-2 "+(key===localDate(new Date(now))?"border-accent bg-indigo-100/70 ring-1 ring-accent dark:bg-indigo-950/70":i%7===0||i%7===6?"border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/20":"border-indigo-100 bg-card/80 dark:border-indigo-900")} aria-label={valid?"Create event on "+key:undefined}>
          {valid&&<><span className="text-xs font-semibold">{day}</span><div className="mt-1 space-y-1">{(grouped[key]||[]).slice(0,3).map(ev=><span key={ev.id} role="button" tabIndex={0} onClick={e=>{e.stopPropagation();void openEvent(ev.id)}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();void openEvent(ev.id)}}} className="block cursor-pointer truncate rounded px-1 py-0.5 text-[10px] font-medium sm:text-xs" style={eventColorStyle(ev.color,ev.type)} title={"View "+ev.name}>{ev.status==="DRAFT"?"Draft: ":""}{ev.name}</span>)}</div></>}
        </button>;
      })}
    </div>
    {loading&&<p className="mt-3 text-sm text-muted">Loading events...</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <section className="mt-8 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 p-4 dark:border-emerald-400 dark:bg-emerald-950/20" aria-label="Upcoming published events">
      <h3 className="text-lg font-semibold">Upcoming published events</h3>
      {published.length===0&&!loading&&!error&&<p className="mt-2 text-sm text-muted">No upcoming published events yet.</p>}
      <div className="mt-3 grid gap-2">{published.map(ev=><button type="button" onClick={()=>void openEvent(ev.id)} key={ev.id} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-left hover:border-accent"><div><p className="font-medium">{ev.name}</p><p className="text-xs text-muted">{ev.college}  |  {types.find(t=>t.value===ev.type)?.label}  |  {new Date(ev.startsAt).toLocaleString()}</p></div><span className="rounded px-2 py-1 text-xs" style={eventColorStyle(ev.color,ev.type)}>Published</span></button>)}</div>
    </section>
    {activeId&&<div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={e=>{if(e.target===e.currentTarget)setActiveId(null)}}><aside role="dialog" aria-modal="true" aria-label="Event details" className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Event details</h2><button type="button" aria-label="Close event details" onClick={()=>setActiveId(null)}>Close</button></div>
      {panelError&&<p role="alert" className="mt-4 text-sm text-red-600">{panelError}</p>}
      {!detail&&!panelError&&<p className="mt-4 text-muted">Loading event...</p>}
      {detail&&<div className="mt-6 space-y-5">
        <div><h3 className="text-2xl font-semibold">{detail.name}</h3><p className="mt-1 text-sm text-muted">{detail.college||"College not assigned"}  |  {types.find(t=>t.value===detail.type)?.label}  |  {new Date(detail.startsAt).toLocaleString()}</p><p className="text-sm text-muted">{[detail.dorm&&"Dorm: "+detail.dorm,detail.major&&"Major: "+detail.major].filter(Boolean).join("  |  ")}</p><p className="text-sm text-muted">{detail.status==="DRAFT"?"Private draft":"Published event"}</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted">Participating</p><p className="text-2xl font-semibold">{detail.participantCount}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted">Slots left</p><p className="text-2xl font-semibold">{Math.max(0,detail.maxParticipants-detail.participantCount)}</p><p className="text-xs text-muted">of {detail.maxParticipants} total</p></div></div>
        <p className="text-sm">{detail.dueAt?new Date(detail.dueAt).getTime()>now?`${Math.ceil((new Date(detail.dueAt).getTime()-now)/86400000)} day(s) left to join  |  Deadline ${new Date(detail.dueAt).toLocaleString()}`:"Joining deadline passed":`No separate joining deadline  |  Event starts ${new Date(detail.startsAt).toLocaleString()}`}</p>
        {detail.paymentRequired&&<p className="text-sm">Payment required {detail.individualCostCents!=null?` |  ${(detail.individualCostCents/100).toFixed(2)} per participant`:""}</p>}
        {detail.waitingListAllowed&&<p className="text-sm">Waiting list: {detail.waitingListCount}{detail.maxWaitingList==null?" (no limit)":` / ${detail.maxWaitingList}`}</p>}
        {detail.isJoined&&<div className="space-y-2"><p className="text-sm font-medium">{detail.participationStatus==="WAITLISTED"?"You are on the waiting list":"Confirmed: You are participating"}</p>{detail.joinedAt&&<p className="text-xs text-muted">Responded {new Date(detail.joinedAt).toLocaleString()}</p>}<button type="button" disabled={busy} onClick={()=>void withdrawEvent()} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">{busy?"Withdrawing...":detail.participationStatus==="WAITLISTED"?"Leave waiting list":"Withdraw from event"}</button></div>}
        {!detail.isJoined&&detail.status==="PUBLISHED"&&<div><label className="block text-sm">Student (optional)<select className="mt-1 w-full rounded-lg border bg-background p-2" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">No student selected</option>{students.filter(s=>s.college.trim().toLowerCase()===detail.college?.trim().toLowerCase()).map(s=><option key={s.id} value={s.id}>{s.name}  -  {s.email}</option>)}</select></label><button type="button" disabled={busy||(detail.participantCount>=detail.maxParticipants&&(!detail.waitingListAllowed||(detail.maxWaitingList!=null&&detail.waitingListCount>=detail.maxWaitingList)))||new Date(detail.startsAt).getTime()<=now||!!(detail.dueAt&&new Date(detail.dueAt).getTime()<=now)} onClick={()=>void joinEvent()} className="mt-3 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40">{busy?"Joining...":detail.participantCount>=detail.maxParticipants?"Join waiting list":"Join event"}</button></div>}
        <a className="inline-flex rounded-full border px-4 py-2 text-sm font-medium" href={`/api/events/${encodeURIComponent(activeId)}/export`}>Download Excel (.xlsx)</a>
        {detail.isOwner&&<div><button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={()=>setEditing(v=>!v)}>{editing?"Cancel editing":"Edit event"}</button>{editing&&<form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={updateEvent}>
        <label className="text-sm">Type<select className="mt-1 w-full rounded-lg border bg-background p-2" value={type} onChange={e=>setType(e.target.value as EventType)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Name<input className="mt-1 w-full rounded-lg border bg-background p-2" required value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="text-sm">College<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={college} onChange={e=>{setCollege(e.target.value);setDorm("");setMajor("")}}><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Major (optional)<select disabled={!college} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 disabled:opacity-50"><option value="">{college?"All majors":"Choose a college first"}</option>{major&&!majorOptions.includes(major)&&<option value={major}>{major} (previously saved)</option>}{majorOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        <EventColorPicker value={eventColor} onChange={setEventColor}/>
        <div className="sm:col-span-2"><DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm (optional)" inlineOther/></div>
        <label className="text-sm">Starts<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" required value={dateTime} onChange={e=>setDateTime(e.target.value)}/></label>
        <label className="text-sm">Join by<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
        <label className="text-sm">Capacity<input className="mt-1 w-full rounded-lg border bg-background p-2" type="number" min="1" required value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)}/></label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={waitingListAllowed} onChange={e=>setWaitingListAllowed(e.target.checked)}/> Is Waiting List Allowed</label>
        {waitingListAllowed&&<label className="text-sm">Max Number in Waiting List (optional)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={maxWaitingList} onChange={e=>{if(/^\d*$/.test(e.target.value))setMaxWaitingList(e.target.value)}} className="mt-1 w-full rounded-lg border bg-background p-2"/><span className="mt-1 block text-xs text-muted">Leave blank for no limit.</span></label>}<label className="text-sm">Visibility<select className="mt-1 w-full rounded-lg border bg-background p-2" value={status} onChange={e=>setStatus(e.target.value as "DRAFT"|"PUBLISHED")}><option value="DRAFT">Private draft</option><option value="PUBLISHED">Published</option></select></label><button disabled={busy} className="rounded-full bg-accent px-4 py-2 text-accent-foreground">{busy?"Saving...":"Save changes"}</button></form>}</div>}
      </div>}
    </aside></div>}
    {selected&&<div className="mt-6 rounded-xl border-2 border-accent border-l-4 bg-accent/5 p-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Create event  |  {selected}</h3><button type="button" onClick={()=>setSelected(null)} aria-label="Close event form">Close</button></div>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Event type<select value={type} onChange={e=>setType(e.target.value as EventType)} className="mt-1 w-full rounded-lg border border-border bg-background p-2">{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Event name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">College<select required value={college} onChange={e=>{setCollege(e.target.value);setDorm("");setMajor("")}} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Major (optional)<select disabled={!college} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 disabled:opacity-50"><option value="">{college?"All majors":"Choose a college first"}</option>{major&&!majorOptions.includes(major)&&<option value={major}>{major} (previously saved)</option>}{majorOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        <EventColorPicker value={eventColor} onChange={setEventColor}/>
        <div className="sm:col-span-2"><DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm (optional)" inlineOther/></div>
        <label className="text-sm">Event date and time<input required type="datetime-local" value={dateTime} onChange={e=>setDateTime(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">Due date and time (optional)<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">Max participants<input required type="number" min={1} max={10000} value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={waitingListAllowed} onChange={e=>setWaitingListAllowed(e.target.checked)}/> Is Waiting List Allowed</label>
        {waitingListAllowed&&<label className="text-sm">Max Number in Waiting List (optional)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={maxWaitingList} onChange={e=>{if(/^\d*$/.test(e.target.value))setMaxWaitingList(e.target.value)}} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/><span className="mt-1 block text-xs text-muted">Leave blank for no limit.</span></label>}
        <label className="text-sm">Visibility<select value={status} onChange={e=>setStatus(e.target.value as "DRAFT"|"PUBLISHED")} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="DRAFT">Draft (private)</option><option value="PUBLISHED">Published (shared)</option></select></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={paymentRequired} onChange={e=>setPaymentRequired(e.target.checked)}/> Payment required</label>
        {paymentRequired&&<><label className="text-sm">Total cost ($)<input type="number" min={0} step=".01" value={totalCost} onChange={e=>setTotalCost(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label><label className="text-sm">Individual cost ($)<input type="number" min={0} step=".01" value={individualCost} onChange={e=>setIndividualCost(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label></>}
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">{saving?"Saving...":"Create event"}</button></div>
      </form>
    </div>}
  </section>;
}

