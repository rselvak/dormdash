import type { TripService } from "@/lib/trip-services";
export type EventType = "COLLEGE_PICKUP"|"COLLEGE_DROP_OFF"|"CARPOOL"|"VANPOOL"|"BUSPOOL"|"PACKAGE_DELIVERY"|"ANNOUNCEMENT";
export type CalendarEvent = {origin:string|null;destination:string|null;instructions:string|null;services:TripService[];requestedServices:TripService[];allDay:boolean;endsAt:string|null;timeZone:string;color:string|null;waitingListAllowed:boolean;maxWaitingList:number|null;waitingListCount:number;participationStatus:"ACCEPTED"|"WAITLISTED"|null;joinedAt:string|null;id:string;name:string;college:string|null;dorm:string|null;major:string|null;startsAt:string;type:EventType;status:"DRAFT"|"PUBLISHED"|"CANCELLED";cancellationReason:string|null;cancelledAt:string|null;isOwner:boolean;isJoined:boolean;participantCount:number;maxParticipants:number;dueAt:string|null;paymentRequired:boolean;totalCostCents:number|null;individualCostCents:number|null;};
export const eventTypes: {value:EventType;label:string}[] = [
  {value:"COLLEGE_PICKUP",label:"Trip To College"},{value:"COLLEGE_DROP_OFF",label:"Trip From College"},
  {value:"CARPOOL",label:"Ride Pool"},{value:"VANPOOL",label:"Amtrak"},
  {value:"BUSPOOL",label:"Buspool"},
];
export const localDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");

export function toLocalInput(value:string){const d=new Date(value);return localDate(d)+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
export function scheduleInput(dateTime: string, allDay: boolean, dueAt: string) {
  if (!allDay) return { startsAt: isoWithOffset(dateTime), dueAt: dueAt ? isoWithOffset(dueAt) : null, allDay: false, endsAt: null };
  const start = new Date(dateTime.slice(0,10) + "T00:00:00");
  if (Number.isNaN(start.getTime())) throw new Error("Choose an event day.");
  const end = new Date(start);
  end.setDate(end.getDate()+1);
  return { startsAt: start.toISOString(), endsAt: end.toISOString(), dueAt: dueAt ? isoWithOffset(dueAt) : null, allDay: true };
}

export function eventDateLabel(event: { startsAt: string; allDay?: boolean; timeZone?: string }) {
  return event.allDay
    ? new Date(event.startsAt).toLocaleDateString("en-US",{timeZone:event.timeZone||"America/Los_Angeles"})+" · All day"
    : new Date(event.startsAt).toLocaleString();
}

export function eventDay(event: { startsAt: string; allDay?: boolean; timeZone?: string }) {
  if (!event.allDay) return localDate(new Date(event.startsAt));
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:event.timeZone||"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(event.startsAt));
  const get=(type:string)=>parts.find(part=>part.type===type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function isoWithOffset(local:string) {
  const date=new Date(local);
  if(Number.isNaN(date.getTime())) throw new Error("Invalid date or time");
  const offset=-date.getTimezoneOffset();
  const sign=offset>=0?"+":"-";
  return local+":00"+sign+String(Math.floor(Math.abs(offset)/60)).padStart(2,"0")+":"+String(Math.abs(offset)%60).padStart(2,"0");
}

export async function readApi(response:Response) {
  const contentType=response.headers.get("content-type")||"";
  if (!contentType.includes("application/json")) {
    throw new Error(response.status===404 ? "Events API was not found. Restart the development server." : `Events service returned an unexpected response (HTTP ${response.status}). Check your Next.js terminal for errors.`);
  }
  const data=await response.json();
  if (!response.ok) throw new Error(data.error||`Events request failed (HTTP ${response.status})`);
  return data;
}

