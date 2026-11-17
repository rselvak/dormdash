"use client";
import { isPastEvent, canCreateSchedule } from "@/lib/event-policy";
import { TransportFields } from "@/components/transport-fields";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RidePoolFields } from "@/components/ride-pool-fields";
import { TripServiceChoices } from "@/components/trip-service-choices";
import { type TripService } from "@/lib/trip-services";
import { DormSelect } from "@/components/dorm-select";
import { getCollegeMajors } from "@/lib/colleges";
import { calendarRange, calendarTitle, moveCalendar, type CalendarView } from "@/lib/calendar-view";
import { CalendarTimeGrid, calendarEventTime } from "@/components/calendar-time-grid";

import { EventColorPicker } from "@/components/event-color-picker";
import { eventColorStyle } from "@/lib/event-color";

import { EventDetailsDialog } from "@/components/event-details-dialog";
import { ShareToWhatsApp, type ShareableEvent } from "@/components/share-to-whatsapp";
import { type CalendarEvent as Event, type EventType, eventTypes as types, localDate, scheduleInput, eventDateLabel, eventDay, toLocalInput, readApi } from "@/lib/event-ui";

export function EventsCalendar() {
  const [month,setMonth]=useState(()=>new Date());
  const [view,setView]=useState<CalendarView>("month");
  const loadSequence=useRef(0);
  const [events,setEvents]=useState<Event[]>([]);
  const [published,setPublished]=useState<Event[]>([]);
  const [colleges,setColleges]=useState<string[]>([]);
  const [college,setCollege]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const createFormRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(selected){createFormRef.current?.scrollIntoView({behavior:"smooth",block:"start"});createFormRef.current?.querySelector<HTMLSelectElement>("select")?.focus({preventScroll:true});}
  },[selected]);
  const [saving,setSaving]=useState(false);
  const [createdEvent,setCreatedEvent]=useState<ShareableEvent|null>(null);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [eventColor,setEventColor]=useState("#2563eb");
  const [transportType,setTransportType]=useState("");
  const [busStops,setBusStops]=useState<string[]>([]);
  const [selectedStop,setSelectedStop]=useState("");
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
    const sequence=++loadSequence.current;
    setLoading(true);setError("");
    try {
      const range=calendarRange(month,view);
      const start=range.start.toISOString();
      const end=range.end.toISOString();
      const params=new URLSearchParams({start,end});
      const res=await fetch("/api/events?"+params,{cache:"no-store"});
      const body=await readApi(res);
      if(sequence!==loadSequence.current)return;
      setEvents(body.events);
      setColleges(body.colleges||[]);
      setCollege(current=>current || body.colleges?.[0] || "");
      const publishedResponse=await fetch("/api/events?published=upcoming",{cache:"no-store"});
      const publishedBody=await readApi(publishedResponse);
      if(sequence!==loadSequence.current)return;
      setPublished(publishedBody.events);
    } catch(e) {if(sequence===loadSequence.current)setError(e instanceof Error?e.message:"Could not load events");}
    finally {if(sequence===loadSequence.current)setLoading(false);}
  },[month,view]);
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
  const range=calendarRange(month,view);
  const dates=Array.from({length:view==="month"?Math.ceil((monthStart.getDay()+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7:view==="week"?7:1},(_,i)=>{
    const date=new Date(range.start);
    date.setDate(date.getDate()+i-(view==="month"?monthStart.getDay():0));
    return date;
  });
  function openForDate(d:string, hour?:number, isAllDay=false) {
    const current=new Date();
    const chosenHour=hour??(d===localDate(current)?Math.min(23,current.getHours()+1):9);
    const chosenTime=hour===undefined&&d===localDate(current)&&current.getHours()===23?toLocalInput(new Date(current.getTime()+60000).toISOString()):d+"T"+String(chosenHour).padStart(2,"0")+":00";
    if(!canCreateSchedule(scheduleInput(chosenTime,isAllDay,""))){setError("Events cannot be created in the past.");return;}
    setSelectedStop("");setTransportType("");setBusStops([]);setOrigin("");setDestination("");
    setCreatedEvent(null);
    setActiveId(null);setSelected(d);setCollege("");setAllDay(false);setDateTime(d+"T09:00");setDueAt("");setName("");setInstructions("");setEventColor("#2563eb");setDorm("");setMajor("");setPaymentRequired(false);setTotalCost("");setIndividualCost("");setStatus("DRAFT");setType("");setServices([]);setMaxParticipants("");setWaitingListAllowed(false);setMaxWaitingList("");setError("");
    setDateTime(chosenTime);setAllDay(isAllDay);
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError("");
    try {
      if(!canCreateSchedule(scheduleInput(dateTime,allDay,dueAt)))throw new Error("Choose a date and time that is not in the past.");
      if(type==="COLLEGE_PICKUP"&&!services.length)throw new Error("Choose at least one service offered.");
      const body={
        selectedStop:type==="BUSPOOL"?selectedStop:null,
        waitingListAllowed,maxWaitingList:waitingListAllowed&&maxWaitingList!==""?Number(maxWaitingList):null,
        name,origin:["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(type)?origin.trim():null,destination:["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(type)?destination.trim():null,transportType:type==="VANPOOL"?transportType:null,busStops:type==="BUSPOOL"?busStops.map(stop=>stop.trim()):[],instructions:instructions.trim()||null,color:eventColor,college,dorm:dorm.trim()||null,major:major.trim()||null,type,services:type==="COLLEGE_PICKUP"?services:[],status,paymentRequired,maxParticipants:Number(maxParticipants),
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
      <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" onClick={()=>openForDate(localDate(month))}>+ Create Event</button>
    </div>
    <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
      <button type="button" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-accent/10" onClick={()=>setMonth(new Date())}>Today</button>
      <div className="flex items-center gap-1">
        {([-1,1] as const).map(direction=><button key={direction} type="button" aria-label={(direction===-1?"Previous ":"Next ")+view} title={(direction===-1?"Previous ":"Next ")+view} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent" onClick={()=>setMonth(current=>moveCalendar(current,view,direction))}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={direction===-1?"m15 18-6-6 6-6":"m9 18 6-6-6-6"}/></svg>
        </button>)}
      </div>
      <h3 className="min-w-0 flex-1 text-lg font-semibold sm:text-xl" aria-live="polite">{calendarTitle(month,view)}</h3>
      <label className="ml-auto"><span className="sr-only">Calendar view</span><select value={view} onChange={e=>setView(e.target.value as CalendarView)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
    </div>
    <p className="mb-3 text-xs text-muted">Double-click a day or time slot to create an event. Keyboard users can focus a day or slot and press Enter.</p>
    {view!=="month"?<CalendarTimeGrid dates={dates} events={events} onOpen={openEvent} onCreate={openForDate}/>:<div className="overflow-x-auto rounded-xl border border-border bg-card" aria-busy={loading}>
      <div>
        {view==="month"&&<div className="grid grid-cols-7 border-b border-border py-3 text-center text-xs font-semibold text-muted">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d}>{d}</div>)}</div>}
        <div className="grid grid-cols-7">
          {dates.map(date=>{
            const key=localDate(date);
            const valid=view!=="month"||date.getMonth()===month.getMonth();
            const today=key===localDate(new Date(now));
            const dayEvents=[...(grouped[key]||[])].sort((a,b)=>Number(b.allDay)-Number(a.allDay)||Date.parse(a.startsAt)-Date.parse(b.startsAt));
            return <div key={key} onDoubleClick={()=>{if(valid)openForDate(key)}} className={"min-w-0 border-b border-r border-border p-1 sm:p-2 "+(view==="month"?"min-h-28 sm:min-h-36 ":"min-h-80 ")+(!valid?"bg-accent/5 ":today?"bg-accent/5 ":"")}>
              {valid&&<><button type="button" onClick={e=>{if(e.detail===0)openForDate(key)}} onDoubleClick={e=>{e.stopPropagation();openForDate(key)}} disabled={key<localDate(new Date())} aria-label={"Create event on "+key} aria-current={today?"date":undefined} className="mb-2 flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-accent/10">
                {view!=="month"&&<span className="text-xs text-muted">{date.toLocaleDateString("en-US",{weekday:"short"})}</span>}
                <span className={"flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold "+(today?"bg-accent text-accent-foreground":"")}>{date.getDate()}</span>
              </button>
              <div className="space-y-1">
                {dayEvents.slice(0,view==="month"?3:undefined).map(ev=><button key={ev.id} type="button" onDoubleClick={e=>e.stopPropagation()} onClick={()=>openEvent(ev.id)} className="block w-full rounded px-1.5 py-1 text-left text-[10px] font-medium hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-xs" style={isPastEvent(ev)?{backgroundColor:"var(--border)",color:"var(--muted)",filter:"grayscale(1)",opacity:0.6}:eventColorStyle(ev.color,ev.type)} title={"View "+ev.name}>
                  <span className="flex min-w-0 items-baseline gap-1"><span className="shrink-0 opacity-80">{calendarEventTime(ev)}</span><span className="truncate">{ev.status==="CANCELLED"?"Cancelled: ":ev.status==="DRAFT"?"Draft: ":""}{ev.name}</span></span>
                  {view!=="month"&&<span className="mt-1 block text-xs opacity-80">{ev.allDay?"All day":new Date(ev.startsAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span>}
                </button>)}
                {view==="month"&&dayEvents.length>3&&<button type="button" className="w-full rounded px-1 py-1 text-left text-xs font-medium text-muted hover:bg-accent/10" onClick={()=>{setMonth(date);setView("day")}}>+{dayEvents.length-3} more</button>}
                {view!=="month"&&dayEvents.length===0&&!loading&&<p className="px-1 py-3 text-xs text-muted">No events</p>}
              </div></>}
            </div>;
          })}
        </div>
      </div>
    </div>}
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
      <div className="mt-3 grid gap-2">{published.map((ev,index)=><button type="button" onClick={()=>void openEvent(ev.id)} key={ev.id} style={{borderLeftColor:eventColorStyle(ev.color,ev.type).backgroundColor}} className={"flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-l-[6px] border-border p-4 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent "+(index%2===0?"bg-card":"bg-accent/5")}><div><p className={"font-medium "+(ev.status==="CANCELLED"?"text-red-700 dark:text-red-400":"")}>{ev.status==="CANCELLED"?"Cancelled: ":""}{ev.name}</p><p className="text-xs text-muted">Created by {ev.createdBy||"Organizer"}  |  {ev.college}  |  {types.find(t=>t.value===ev.type)?.label}  |  {eventDateLabel(ev)}</p></div><span className="rounded px-2 py-1 text-xs" style={eventColorStyle(ev.color,ev.type)}>{ev.status==="CANCELLED"?"Cancelled":"Published"}</span></button>)}</div>
    </section>}
    {activeId&&<EventDetailsDialog key={activeId} eventId={activeId} colleges={colleges} onClose={()=>setActiveId(null)} onChanged={load}/>}
    {selected&&<div ref={createFormRef} className="mt-6 scroll-mt-6 rounded-xl border-2 border-accent border-l-4 bg-accent/5 p-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Create event  |  {selected}</h3><button type="button" onClick={()=>setSelected(null)} aria-label="Close event form">Close</button></div>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Event type *<select required value={type} onChange={e=>{setType(e.target.value as EventType);setServices([])}} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select event type</option>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Event name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="text-sm">College *<select required value={college} onChange={e=>{setCollege(e.target.value);setDorm("");setMajor("")}} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Major (optional)<select disabled={!college} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 disabled:opacity-50"><option value="">{college?"All majors":"Choose a college first"}</option>{major&&!majorOptions.includes(major)&&<option value={major}>{major} (previously saved)</option>}{majorOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        {["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(type)&&<RidePoolFields origin={origin} destination={destination} onOriginChange={setOrigin} onDestinationChange={setDestination}/> }
        <TransportFields type={type} transportType={transportType} busStops={busStops} onTransportType={setTransportType} onBusStops={setBusStops} selectedStop={selectedStop} onSelectedStop={setSelectedStop}/>
        {type==="COLLEGE_PICKUP"&&<TripServiceChoices value={services} onChange={setServices}/>}
        <label className="text-sm sm:col-span-2">Instructions (optional)<textarea rows={4} maxLength={4000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Add meeting points, package handover details, or other instructions." className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <EventColorPicker value={eventColor} onChange={setEventColor}/>
        <div className="sm:col-span-2"><DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm (optional)" inlineOther/></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/> All day event</label>
        {allDay&&<label className="text-sm">Event date *<input required type="date" min={new Date().toLocaleDateString("en-CA")} value={dateTime.slice(0,10)} onChange={e=>setDateTime(e.target.value+"T00:00")} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>}
        {!allDay&&<>
        <label className="text-sm">Event date and time<input required type="datetime-local" min={toLocalInput(new Date().toISOString()).slice(0,16)} value={dateTime} onChange={e=>setDateTime(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
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

