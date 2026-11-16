"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RidePoolFields } from "@/components/ride-pool-fields";
import { TripServiceChoices } from "@/components/trip-service-choices";
import { type TripService } from "@/lib/trip-services";
import { DormSelect } from "@/components/dorm-select";
import { getCollegeMajors } from "@/lib/colleges";

import { EventColorPicker } from "@/components/event-color-picker";
import { eventColorStyle } from "@/lib/event-color";

import { EventDetailsDialog } from "@/components/event-details-dialog";
import { ShareToWhatsApp, type ShareableEvent } from "@/components/share-to-whatsapp";
import { type CalendarEvent as Event, type EventType, eventTypes as types, localDate, scheduleInput, eventDateLabel, eventDay, readApi } from "@/lib/event-ui";

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
  const [createdEvent,setCreatedEvent]=useState<ShareableEvent|null>(null);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [eventColor,setEventColor]=useState("#2563eb");
  const [origin,setOrigin]=useState("");
  const [destination,setDestination]=useState("");
  const [instructions,setInstructions]=useState("");
  const [name,setName]=useState("");
  const [dorm,setDorm]=useState("");
  const [major,setMajor]=useState("");
  const majorOptions=useMemo(()=>getCollegeMajors(college),[college]);
  const [allDay,setAllDay]=useState(false);
  const [dateTime,setDateTime]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [services,setServices]=useState<TripService[]>([]);
  const [type,setType]=useState<EventType|"">("");
  const [status,setStatus]=useState<"DRAFT"|"PUBLISHED">("DRAFT");
  const [paymentRequired,setPaymentRequired]=useState(false);
  const [totalCost,setTotalCost]=useState("");
  const [individualCost,setIndividualCost]=useState("");
  const [maxParticipants,setMaxParticipants]=useState("");
  const [waitingListAllowed,setWaitingListAllowed]=useState(false);
  const [maxWaitingList,setMaxWaitingList]=useState("");
  const [now]=useState(()=>Date.now());
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
  useEffect(()=>{
    const eventId=new URLSearchParams(window.location.search).get("event");
    if(eventId)void Promise.resolve().then(()=>setActiveId(eventId));
  },[]);
  function openEvent(id:string){setCreatedEvent(null);setActiveId(id);setSelected(null);}
  const grouped=useMemo(()=>{
    const result:Record<string,Event[]>={};
    for(const event of events) {
      const key=eventDay(event);
      (result[key]??=[]).push(event);
    }
    return result;
  },[events]);
  const cells=Array.from({length:Math.ceil((monthStart.getDay()+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7},(_,i)=>i-monthStart.getDay()+1);
  function open(day:number) {
    openForDate(localDate(new Date(month.getFullYear(),month.getMonth(),day)));
  }
  function openForDate(d:string) {
    setCreatedEvent(null);
    setActiveId(null);setSelected(d);setCollege("");setAllDay(false);setDateTime(d+"T09:00");setDueAt("");setName("");setInstructions("");setEventColor("#2563eb");setDorm("");setMajor("");setPaymentRequired(false);setTotalCost("");setIndividualCost("");setStatus("DRAFT");setType("");setServices([]);setMaxParticipants("");setWaitingListAllowed(false);setMaxWaitingList("");setError("");
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError("");
    try {
      if(type==="COLLEGE_PICKUP"&&!services.length)throw new Error("Choose at least one service offered.");
      const body={
        waitingListAllowed,maxWaitingList:waitingListAllowed&&maxWaitingList!==""?Number(maxWaitingList):null,
        name,origin:type==="CARPOOL"?origin.trim():null,destination:type==="CARPOOL"?destination.trim():null,instructions:instructions.trim()||null,color:eventColor,college,dorm:dorm.trim()||null,major:major.trim()||null,type,services:type==="COLLEGE_PICKUP"?services:[],status,paymentRequired,maxParticipants:Number(maxParticipants),
        ...scheduleInput(dateTime,allDay,dueAt),
        timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
        totalCostCents:paymentRequired&&totalCost!==""?Math.round(Number(totalCost)*100):null,
        individualCostCents:paymentRequired&&individualCost!==""?Math.round(Number(individualCost)*100):null,
      };
      const res=await fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await readApi(res);
      setCreatedEvent(result.event);
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
          {valid&&<><span className="text-xs font-semibold">{day}</span><div className="mt-1 space-y-1">{(grouped[key]||[]).slice(0,3).map(ev=><span key={ev.id} role="button" tabIndex={0} onClick={e=>{e.stopPropagation();void openEvent(ev.id)}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();void openEvent(ev.id)}}} className="block cursor-pointer truncate rounded px-1 py-0.5 text-[10px] font-medium sm:text-xs" style={eventColorStyle(ev.color,ev.type)} title={"View "+ev.name}>{ev.status==="CANCELLED"?"Cancelled: ":ev.status==="DRAFT"?"Draft: ":""}{ev.name}</span>)}</div></>}
        </button>;
      })}
    </div>
    {loading&&<p className="mt-3 text-sm text-muted">Loading events...</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {createdEvent&&!selected&&<div className="mt-4 rounded-xl border border-green-600 bg-green-50 p-4 dark:bg-green-950/20">
      <p role="status" className="mb-2 text-sm font-medium">{createdEvent.name} created{createdEvent.status==="DRAFT"?" as a private draft":" and published"}.</p>
      {createdEvent.status==="PUBLISHED"?<><ShareToWhatsApp event={createdEvent} isOwner/><p className="mt-2 text-xs text-muted">Choose a WhatsApp chat or group, then tap Send. Recipients sign in to view the event.</p></>:<p className="text-sm text-muted">Publish your event to share it on WhatsApp.</p>}
      <button type="button" onClick={()=>setCreatedEvent(null)} className="ml-3 text-sm underline">Dismiss</button>
    </div>}
    {!selected&&<section className="mt-8 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 p-4 dark:border-emerald-400 dark:bg-emerald-950/20" aria-label="Upcoming published events">
      <h3 className="text-lg font-semibold">Upcoming published events</h3>
      {published.length===0&&!loading&&!error&&<p className="mt-2 text-sm text-muted">No upcoming published events yet.</p>}
      <div className="mt-3 grid gap-2">{published.map((ev,index)=><button type="button" onClick={()=>void openEvent(ev.id)} key={ev.id} style={{borderLeftColor:eventColorStyle(ev.color,ev.type).backgroundColor}} className={"flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-l-[6px] border-border p-4 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent "+(index%2===0?"bg-card":"bg-accent/5")}><div><p className={"font-medium "+(ev.status==="CANCELLED"?"text-red-700 dark:text-red-400":"")}>{ev.status==="CANCELLED"?"Cancelled: ":""}{ev.name}</p><p className="text-xs text-muted">{ev.college}  |  {types.find(t=>t.value===ev.type)?.label}  |  {eventDateLabel(ev)}</p></div><span className="rounded px-2 py-1 text-xs" style={eventColorStyle(ev.color,ev.type)}>{ev.status==="CANCELLED"?"Cancelled":"Published"}</span></button>)}</div>
    </section>}
    {activeId&&<EventDetailsDialog key={activeId} eventId={activeId} colleges={colleges} onClose={()=>setActiveId(null)} onChanged={load}/>}
    {selected&&<div className="mt-6 rounded-xl border-2 border-accent border-l-4 bg-accent/5 p-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Create event  |  {selected}</h3><button type="button" onClick={()=>setSelected(null)} aria-label="Close event form">Close</button></div>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Event type *<select required value={type} onChange={e=>{setType(e.target.value as EventType);setServices([])}} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select event type</option>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Event name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">College *<select required value={college} onChange={e=>{setCollege(e.target.value);setDorm("");setMajor("")}} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Major (optional)<select disabled={!college} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 disabled:opacity-50"><option value="">{college?"All majors":"Choose a college first"}</option>{major&&!majorOptions.includes(major)&&<option value={major}>{major} (previously saved)</option>}{majorOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        {type==="CARPOOL"&&<RidePoolFields origin={origin} destination={destination} onOriginChange={setOrigin} onDestinationChange={setDestination}/> }
        {type==="COLLEGE_PICKUP"&&<TripServiceChoices value={services} onChange={setServices}/>}
        <label className="text-sm sm:col-span-2">Instructions (optional)<textarea rows={4} maxLength={4000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Add meeting points, package handover details, or other instructions." className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <EventColorPicker value={eventColor} onChange={setEventColor}/>
        <div className="sm:col-span-2"><DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm (optional)" inlineOther/></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/> All day event</label>
        {!allDay&&<>
        <label className="text-sm">Event date and time<input required type="datetime-local" value={dateTime} onChange={e=>setDateTime(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        </>}
        <label className="text-sm">Respond to event by (optional)<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">{type==="COLLEGE_PICKUP"?"Max Passengers for Carpool":"Max participants"} *<input required type="number" min={1} max={10000} value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
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

