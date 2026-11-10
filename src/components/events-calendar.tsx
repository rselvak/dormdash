"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventType = "COLLEGE_PICKUP"|"COLLEGE_DROP_OFF"|"CARPOOL"|"VANPOOL"|"BUSPOOL"|"PACKAGE_DELIVERY"|"ANNOUNCEMENT";
type Event = {id:string;name:string;startsAt:string;type:EventType;status:"DRAFT"|"PUBLISHED";isOwner:boolean};
const types: {value:EventType;label:string}[] = [
  {value:"COLLEGE_PICKUP",label:"College pickup"},{value:"COLLEGE_DROP_OFF",label:"College drop-off"},
  {value:"CARPOOL",label:"Carpool"},{value:"VANPOOL",label:"Vanpool"},
  {value:"BUSPOOL",label:"Buspool"},{value:"PACKAGE_DELIVERY",label:"Package delivery"},
  {value:"ANNOUNCEMENT",label:"Announcement"},
];
const colors:Record<EventType,string>={COLLEGE_PICKUP:"bg-blue-100 text-blue-900",COLLEGE_DROP_OFF:"bg-emerald-100 text-emerald-900",CARPOOL:"bg-violet-100 text-violet-900",VANPOOL:"bg-orange-100 text-orange-900",BUSPOOL:"bg-cyan-100 text-cyan-900",PACKAGE_DELIVERY:"bg-amber-100 text-amber-900",ANNOUNCEMENT:"bg-pink-100 text-pink-900"};
const localDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today=()=>localDate(new Date());
function isoWithOffset(local:string) {
  const date=new Date(local);
  if(Number.isNaN(date.getTime())) throw new Error("Invalid date or time");
  const offset=-date.getTimezoneOffset();
  const sign=offset>=0?"+":"-";
  return local+":00"+sign+String(Math.floor(Math.abs(offset)/60)).padStart(2,"0")+":"+String(Math.abs(offset)%60).padStart(2,"0");
}

export function EventsCalendar() {
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [events,setEvents]=useState<Event[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [name,setName]=useState("");
  const [dateTime,setDateTime]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [type,setType]=useState<EventType>("COLLEGE_PICKUP");
  const [status,setStatus]=useState<"DRAFT"|"PUBLISHED">("DRAFT");
  const [paymentRequired,setPaymentRequired]=useState(false);
  const [totalCost,setTotalCost]=useState("");
  const [individualCost,setIndividualCost]=useState("");
  const [maxParticipants,setMaxParticipants]=useState("4");
  const monthStart=new Date(month.getFullYear(),month.getMonth(),1);
  const nextMonth=new Date(month.getFullYear(),month.getMonth()+1,1);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const params=new URLSearchParams({start:monthStart.toISOString(),end:nextMonth.toISOString()});
      const res=await fetch("/api/events?"+params,{cache:"no-store"});
      const body=await res.json();
      if(!res.ok) throw new Error(body.error||"Could not load events");
      setEvents(body.events);
    } catch(e) {setError(e instanceof Error?e.message:"Could not load events");}
    finally {setLoading(false);}
  },[month.getFullYear(),month.getMonth()]);
  useEffect(()=>{void load()},[load]);
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
    const d=localDate(new Date(month.getFullYear(),month.getMonth(),day));
    setSelected(d);setDateTime(d+"T09:00");setDueAt("");setName("");setPaymentRequired(false);setTotalCost("");setIndividualCost("");setStatus("DRAFT");setType("COLLEGE_PICKUP");setMaxParticipants("4");setError("");
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError("");
    try {
      const body={
        name,type,status,paymentRequired,maxParticipants:Number(maxParticipants),
        startsAt:isoWithOffset(dateTime),
        dueAt:dueAt?isoWithOffset(dueAt):null,
        timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
        totalCostCents:paymentRequired&&totalCost!==""?Math.round(Number(totalCost)*100):null,
        individualCostCents:paymentRequired&&individualCost!==""?Math.round(Number(individualCost)*100):null,
      };
      const res=await fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await res.json();
      if(!res.ok) throw new Error(result.error+(result.details?" — "+JSON.stringify(result.details.fieldErrors):""));
      setSelected(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to create event");}
    finally{setSaving(false);}
  }
  return <section className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Shared events calendar">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Family travel calendar</h2><p className="text-sm text-muted">Published events are shared. Your drafts are private.</p></div>
      <div className="flex items-center gap-2">
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
          {valid&&<><span className="text-xs font-semibold">{day}</span><div className="mt-1 space-y-1">{(grouped[key]||[]).slice(0,3).map(ev=><div key={ev.id} className={"truncate rounded px-1 py-0.5 text-[10px] sm:text-xs "+colors[ev.type]} title={ev.name}>{ev.status==="DRAFT"?"🔒 ":""}{ev.name}</div>)}</div></>}
        </button>;
      })}
    </div>
    {loading&&<p className="mt-3 text-sm text-muted">Loading events…</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {selected&&<div className="mt-6 rounded-xl border border-border p-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Create event · {selected}</h3><button type="button" onClick={()=>setSelected(null)} aria-label="Close event form">✕</button></div>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Event name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
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
