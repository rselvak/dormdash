"use client";
import { isPastEvent, canCreateSchedule } from "@/lib/event-policy";
import { TransportFields } from "@/components/transport-fields";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpotOfferActions } from "@/components/spot-offer-actions";
import { RidePoolFields } from "@/components/ride-pool-fields";
import { TripServiceChoices } from "@/components/trip-service-choices";
import { ShareToWhatsApp } from "@/components/share-to-whatsapp";
import { type TripService, serviceSummary } from "@/lib/trip-services";
import { DormSelect } from "@/components/dorm-select";
import { EventColorPicker } from "@/components/event-color-picker";
import { getCollegeMajors } from "@/lib/colleges";
import { eventColorStyle } from "@/lib/event-color";
import { type CalendarEvent as Event, type EventType, eventTypes as types, toLocalInput, scheduleInput, eventDateLabel, eventDay, readApi } from "@/lib/event-ui";

export function EventDetailsDialog({ eventId: activeId, colleges, onClose, onChanged }: { eventId: string; colleges: string[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [detail,setDetail]=useState<Event|null>(null);
  const [students,setStudents]=useState<{id:string;name:string;email:string;college:string}[]>([]);
  const [requestedServices,setRequestedServices]=useState<TripService[]>([]);
  const [selectedStop,setSelectedStop]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [studentId,setStudentId]=useState("");
  const [editing,setEditing]=useState(false);
  const [cancelling,setCancelling]=useState(false);
  const [cancellationReason,setCancellationReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [panelError,setPanelError]=useState("");
  const [transportType,setTransportType]=useState("");
  const [busStops,setBusStops]=useState<string[]>([]);
  const [origin,setOrigin]=useState("");
  const [destination,setDestination]=useState("");
  const [instructions,setInstructions]=useState("");
  const [name,setName]=useState("");
  const [college,setCollege]=useState("");
  const [dorm,setDorm]=useState("");
  const [major,setMajor]=useState("");
  const majorOptions=useMemo(()=>getCollegeMajors(college),[college]);
  const [eventColor,setEventColor]=useState("#2563eb");
  const [services,setServices]=useState<TripService[]>([]);
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
    try {const data=await readApi(await fetch(`/api/events/${encodeURIComponent(id)}`,{cache:"no-store"}));setNow(Date.now());setPanelError("");setEditing(false);setDetail(data.event);setStudents(data.students);setStudentId(data.event.selectedStudentId||"");setSelectedStop(data.event.selectedStop||"");setTransportType(data.event.transportType||"");setBusStops(data.event.busStops||[]);setName(data.event.name);setOrigin(data.event.origin||"");setDestination(data.event.destination||"");setInstructions(data.event.instructions||"");setEventColor(eventColorStyle(data.event.color,data.event.type).backgroundColor);setDorm(data.event.dorm||"");setMajor(data.event.major||"");setCollege(data.event.college||"");setType(data.event.type);setServices(data.event.services??[]);setRequestedServices(data.event.requestedServices??[]);setStatus(data.event.status==="CANCELLED"?"PUBLISHED":data.event.status);setMaxParticipants(String(data.event.maxParticipants));setWaitingListAllowed(data.event.waitingListAllowed);setMaxWaitingList(data.event.maxWaitingList==null?"":String(data.event.maxWaitingList));setAllDay(data.event.allDay);setDateTime(data.event.allDay?eventDay(data.event)+"T00:00":toLocalInput(data.event.startsAt));setDueAt(data.event.dueAt?toLocalInput(data.event.dueAt):"");}catch(e){setPanelError(e instanceof Error?e.message:"Unable to open event");}
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
  async function joinEvent(){if(!activeId)return;if(!studentId){setPanelError("Select a student before joining.");return;}setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId,selectedStop:detail?.type==="BUSPOOL"?selectedStop:null,requestedServices:detail?.type==="COLLEGE_PICKUP"?requestedServices:[]})}));await onChanged();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to join");}finally{setBusy(false);}}
  async function withdrawEvent(){if(!activeId)return;setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/join`,{method:"DELETE"}));await onChanged();await openEvent(activeId);}catch(e){setPanelError(e instanceof Error?e.message:"Unable to withdraw");}finally{setBusy(false);}}
  async function updateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;

    setBusy(true);
    setPanelError("");

    try {
      if(!canCreateSchedule(scheduleInput(dateTime,allDay,dueAt)))throw new Error("Choose a date and time that is not in the past.");
      if(type==="COLLEGE_PICKUP"&&!services.length)throw new Error("Choose at least one service offered.");
      await readApi(
        await fetch(`/api/events/${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,origin:["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(type)?origin.trim():null,destination:["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(type)?destination.trim():null,transportType:type==="VANPOOL"?transportType:null,busStops:type==="BUSPOOL"?busStops.map(stop=>stop.trim()):[],instructions:instructions.trim()||null,color:eventColor,
            college,
            dorm: dorm.trim() || null,
            major: major.trim() || null,
            type,services:type==="COLLEGE_PICKUP"?services:[],
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

  async function cancelEvent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);setPanelError("");
    try {
      await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}/cancel`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({reason:cancellationReason}) }));
      setCancelling(false);setCancellationReason("");
      await onChanged();await openEvent(activeId);
    } catch(e) {setPanelError(e instanceof Error?e.message:"Unable to cancel event");}
    finally {setBusy(false);}
  }

  const past=detail?isPastEvent(detail,now):false;
  async function deleteDraft(){setBusy(true);setPanelError("");try{await readApi(await fetch(`/api/events/${encodeURIComponent(activeId)}`,{method:"DELETE"}));await onChanged();onClose();}catch(e){setPanelError(e instanceof Error?e.message:"Unable to delete draft");}finally{setBusy(false)}}
  return (<div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside ref={dialogRef} tabIndex={-1} onKeyDown={event=>{
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.key!=="Tab")return;
    const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===event.currentTarget)){event.preventDefault();first?.focus()}
  }} role="dialog" aria-modal="true" aria-label="Event details" className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Event details</h2><button type="button" aria-label="Close event details" onClick={()=>onClose()}>Close</button></div>
      {panelError&&<p role="alert" className="mt-4 text-sm text-red-600">{panelError}</p>}
      {!detail&&!panelError&&<p className="mt-4 text-muted">Loading event...</p>}
      {detail&&<div className={"mt-6 space-y-5 "+(past?"text-muted":"")}>
        {past&&<p role="status" className="rounded-lg border border-border bg-accent/5 p-3 text-sm">Past event — read-only</p>}
        <p className="text-sm text-muted">Created by {detail.createdBy||"Organizer"}</p>
        <div><h3 className="text-2xl font-semibold">{detail.name}</h3><p className="mt-1 text-sm text-muted">{detail.college||"College not assigned"}  |  {types.find(t=>t.value===detail.type)?.label}  |  {eventDateLabel(detail)}</p><p className="text-sm text-muted">{[detail.dorm&&"Dorm: "+detail.dorm,detail.major&&"Major: "+detail.major].filter(Boolean).join("  |  ")}</p><p className="text-sm text-muted">{detail.status==="CANCELLED"?"Cancelled event":detail.status==="DRAFT"?"Private draft":"Published event"}</p></div>
        {["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(detail.type)&&<div className="grid gap-2 rounded-lg border border-border p-4 text-sm"><p><strong>Source:</strong> {detail.origin||"Not provided"}</p><p><strong>Destination:</strong> {detail.destination||"Not provided"}</p></div>}
        {detail.type==="VANPOOL"&&<p className="text-sm">Transport: {detail.transportType==="BUS"?"Bus":"Train"}</p>}
        {detail.type==="BUSPOOL"&&<p className="text-sm">Stops: {(detail.busStops||[]).join(" → ")}{detail.selectedStop&&<span className="mt-1 block">Your stop: {detail.selectedStop}</span>}</p>}
        {detail.instructions&&<section aria-label="Event instructions" className="rounded-lg border border-border bg-accent/5 p-4"><h3 className="text-sm font-semibold">Instructions</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{detail.instructions}</p></section>}
        <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted">Participating</p><p className="text-2xl font-semibold">{detail.participantCount}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted">Slots left</p><p className="text-2xl font-semibold">{Math.max(0,detail.maxParticipants-detail.participantCount-(detail.offeredCount||0))}</p><p className="text-xs text-muted">of {detail.maxParticipants} total</p></div></div>
        <p className="text-sm">{detail.dueAt?new Date(detail.dueAt).getTime()>now?`${Math.ceil((new Date(detail.dueAt).getTime()-now)/86400000)} day(s) left to respond  |  Respond by ${new Date(detail.dueAt).toLocaleString()}`:"Response deadline passed":`No separate joining deadline  |  Event starts ${new Date(detail.startsAt).toLocaleString()}`}</p>
        {detail.type==="COLLEGE_PICKUP"&&<p className="text-sm">Services offered: {serviceSummary(detail.services)}</p>}
        {detail.isJoined&&detail.type==="COLLEGE_PICKUP"&&detail.requestedServices.length>0&&<p className="text-sm">Your request: {serviceSummary(detail.requestedServices)}</p>}
        {detail.paymentRequired&&<p className="text-sm">Payment required {detail.individualCostCents!=null?` |  ${(detail.individualCostCents/100).toFixed(2)} per participant`:""}</p>}
        {(detail.offeredCount||0)>0&&<p className="text-sm">{detail.offeredCount} spot(s) reserved pending confirmation.</p>}
        {!past&&detail.status==="PUBLISHED"&&detail.participationStatus==="OFFERED"&&<SpotOfferActions participantId={detail.participantId||""} eventId={activeId} version={detail.offerVersion||0} expiresAt={detail.offerExpiresAt} onChanged={async()=>{await onChanged();await openEvent(activeId)}}/>}
        {detail.waitingListAllowed&&<p className="text-sm">Waiting list: {detail.waitingListCount}{detail.maxWaitingList==null?" (no limit)":` / ${detail.maxWaitingList}`}</p>}
        {!past&&detail.isJoined&&detail.participationStatus!=="OFFERED"&&detail.status!=="CANCELLED"&&<div className="space-y-2"><p className="text-sm font-medium">{detail.participationStatus==="WAITLISTED"?"You are on the waiting list":"Confirmed: You are participating"}</p>{detail.joinedAt&&<p className="text-xs text-muted">Responded {new Date(detail.joinedAt).toLocaleString()}</p>}<button type="button" disabled={busy} onClick={()=>void withdrawEvent()} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">{busy?"Withdrawing...":detail.participationStatus==="WAITLISTED"?"Leave waiting list":"Withdraw from event"}</button></div>}
        {!past&&!detail.isJoined&&detail.status==="PUBLISHED"&&<div><label className="block text-sm">Student *<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select a student</option>{students.filter(s=>s.college.trim().toLowerCase()===detail.college?.trim().toLowerCase()).map(s=><option key={s.id} value={s.id}>{s.name}  -  {s.email}</option>)}</select></label>{detail.type==="COLLEGE_PICKUP"&&<div className="mt-3"><TripServiceChoices value={requestedServices} onChange={setRequestedServices} offered={detail.services} label="Services requested *"/></div>}{detail.type==="BUSPOOL"&&<label className="mt-3 block text-sm">Select your stop *<select required value={selectedStop} onChange={e=>setSelectedStop(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2"><option value="">Choose a stop</option>{(detail.busStops||[]).map(stop=><option key={stop} value={stop}>{stop}</option>)}</select></label>}<button type="button" disabled={busy||!studentId||(detail.type==="BUSPOOL"&&!selectedStop)||(detail.type==="COLLEGE_PICKUP"&&!requestedServices.length)||((detail.participantCount+(detail.offeredCount||0))>=detail.maxParticipants&&(!detail.waitingListAllowed||(detail.maxWaitingList!=null&&detail.waitingListCount>=detail.maxWaitingList)))||new Date(detail.allDay&&detail.endsAt?detail.endsAt:detail.startsAt).getTime()<=now||!!(detail.dueAt&&new Date(detail.dueAt).getTime()<=now)} onClick={()=>void joinEvent()} className="mt-3 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40">{busy?"Joining...":(detail.participantCount+(detail.offeredCount||0))>=detail.maxParticipants?"Join waiting list":"Join event"}</button></div>}
        <a className="inline-flex rounded-full border px-4 py-2 text-sm font-medium" href={`/api/events/${encodeURIComponent(activeId)}/export`}>Download Excel (.xlsx)</a>
        <div className="space-y-2">
          <a className="inline-flex rounded-full border-2 border-accent px-4 py-2 text-sm font-medium text-accent" href={`/api/events/${encodeURIComponent(activeId)}/calendar`}>Add to calendar (.ics)</a>
          <p className="text-xs text-muted">Import into Google Calendar, Outlook, or Apple Calendar. This saved copy won’t automatically update if the event changes.</p>
        </div>
        {detail.status==="CANCELLED"&&<section role="status" className="rounded-xl border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <h3 className="font-semibold text-red-700 dark:text-red-400">Event cancelled</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{detail.cancellationReason}</p>
          {detail.cancelledAt&&<p className="mt-2 text-xs text-muted">Cancelled {new Date(detail.cancelledAt).toLocaleString()}</p>}
          <p className="mt-2 text-sm">Participation is closed. Accepted and waitlisted participants have been notified in the app.</p>
        </section>}
        {!past&&detail.isOwner&&detail.status==="DRAFT"&&<section className="rounded-lg border border-red-400 p-3">{confirmDelete?<><p className="text-sm">Permanently delete this private draft?</p><button type="button" disabled={busy} onClick={()=>void deleteDraft()} className="mr-3 mt-2 text-sm font-semibold text-red-700">Delete draft</button><button type="button" disabled={busy} onClick={()=>setConfirmDelete(false)} className="text-sm underline">Keep draft</button></>:<button type="button" onClick={()=>setConfirmDelete(true)} className="text-sm text-red-700">Delete draft</button>}</section>}
        <ShareToWhatsApp event={detail} isOwner={detail.isOwner}/>
        {!past&&detail.isOwner&&detail.status==="PUBLISHED"&&<section className="rounded-xl border border-red-400 p-4">
          {!cancelling?<button type="button" disabled={busy} onClick={()=>{setCancelling(true);setEditing(false)}} className="text-sm font-semibold text-red-700 dark:text-red-400">Cancel event</button>:<form onSubmit={cancelEvent} className="space-y-3">
            <label className="block text-sm font-medium">Cancellation reason *<textarea required maxLength={2000} rows={3} value={cancellationReason} onChange={e=>setCancellationReason(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-2"/></label>
            <p className="text-sm text-muted">This will close participation, notify accepted and waitlisted participants in the app, and queue cancellation emails including your reason. The event stays visible as cancelled and cannot be reopened.</p>
            <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy||!cancellationReason.trim()} className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Cancelling…":"Confirm cancellation"}</button><button type="button" disabled={busy} onClick={()=>setCancelling(false)} className="text-sm underline">Keep event</button></div>
          </form>}
        </section>}
        {!past&&detail.isOwner&&detail.status!=="CANCELLED"&&<div><button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={()=>setEditing(v=>!v)}>{editing?"Cancel editing":"Edit event"}</button>{editing&&<form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={updateEvent}>
        <label className="text-sm">Event type *<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={type} onChange={e=>{setType(e.target.value as EventType);setServices([])}}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="text-sm">Name<input className="mt-1 w-full rounded-lg border bg-background p-2" required value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="text-sm">College *<select required className="mt-1 w-full rounded-lg border bg-background p-2" value={college} onChange={e=>{setCollege(e.target.value);setDorm("");setMajor("")}}><option value="">Select college</option>{colleges.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm">Major (optional)<select disabled={!college} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 disabled:opacity-50"><option value="">{college?"All majors":"Choose a college first"}</option>{major&&!majorOptions.includes(major)&&<option value={major}>{major} (previously saved)</option>}{majorOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        {["CARPOOL","COLLEGE_DROP_OFF","VANPOOL"].includes(type)&&<RidePoolFields origin={origin} destination={destination} onOriginChange={setOrigin} onDestinationChange={setDestination}/> }
        <TransportFields type={type} transportType={transportType} busStops={busStops} onTransportType={setTransportType} onBusStops={setBusStops}/>
        {type==="COLLEGE_PICKUP"&&<TripServiceChoices value={services} onChange={setServices}/>}
        <label className="text-sm sm:col-span-2">Instructions (optional)<textarea rows={4} maxLength={4000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Add meeting points, package handover details, or other instructions." className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>
        <EventColorPicker value={eventColor} onChange={setEventColor}/>
        <div className="sm:col-span-2"><DormSelect key={college} college={college} value={dorm} onChange={setDorm} label="Dorm (optional)" inlineOther/></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/> All day event</label>
        {allDay&&<label className="text-sm">Event date *<input required type="date" min={new Date().toLocaleDateString("en-CA")} value={dateTime.slice(0,10)} onChange={e=>setDateTime(e.target.value+"T00:00")} className="mt-1 w-full rounded-lg border border-border bg-background p-2"/></label>}
        {!allDay&&<>
        <label className="text-sm">Starts<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" required value={dateTime} onChange={e=>setDateTime(e.target.value)}/></label>
        </>}
        <label className="text-sm">Respond to event by (optional)<input className="mt-1 w-full rounded-lg border bg-background p-2" type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
        <label className="text-sm">{type==="COLLEGE_PICKUP"?"Max Passengers for Carpool":"Max participants"} *<input className="mt-1 w-full rounded-lg border bg-background p-2" type="number" min="1" required value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)}/></label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={waitingListAllowed} onChange={e=>setWaitingListAllowed(e.target.checked)}/> Is Waiting List Allowed</label>
        {waitingListAllowed&&<label className="text-sm">Max Number in Waiting List (optional)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={maxWaitingList} onChange={e=>{if(/^\d*$/.test(e.target.value))setMaxWaitingList(e.target.value)}} className="mt-1 w-full rounded-lg border bg-background p-2"/><span className="mt-1 block text-xs text-muted">Leave blank for no limit.</span></label>}<label className="text-sm">Visibility<select className="mt-1 w-full rounded-lg border bg-background p-2" value={status} onChange={e=>setStatus(e.target.value as "DRAFT"|"PUBLISHED")}><option value="DRAFT">Private draft</option><option value="PUBLISHED">Published</option></select></label><button disabled={busy} className="rounded-full bg-accent px-4 py-2 text-accent-foreground">{busy?"Saving...":"Save changes"}</button></form>}</div>}
      </div>}
    </aside></div>);
}
