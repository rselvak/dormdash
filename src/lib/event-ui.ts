export type EventType = "COLLEGE_PICKUP"|"COLLEGE_DROP_OFF"|"CARPOOL"|"VANPOOL"|"BUSPOOL"|"PACKAGE_DELIVERY"|"ANNOUNCEMENT";
export type CalendarEvent = {color:string|null;waitingListAllowed:boolean;maxWaitingList:number|null;waitingListCount:number;participationStatus:"ACCEPTED"|"WAITLISTED"|null;joinedAt:string|null;id:string;name:string;college:string|null;dorm:string|null;major:string|null;startsAt:string;type:EventType;status:"DRAFT"|"PUBLISHED";isOwner:boolean;isJoined:boolean;participantCount:number;maxParticipants:number;dueAt:string|null;paymentRequired:boolean;totalCostCents:number|null;individualCostCents:number|null;};
export const eventTypes: {value:EventType;label:string}[] = [
  {value:"COLLEGE_PICKUP",label:"College pickup"},{value:"COLLEGE_DROP_OFF",label:"College drop-off"},
  {value:"CARPOOL",label:"Carpool"},{value:"VANPOOL",label:"Vanpool"},
  {value:"BUSPOOL",label:"Buspool"},{value:"PACKAGE_DELIVERY",label:"Package delivery"},
  {value:"ANNOUNCEMENT",label:"Announcement"},
];
export const localDate=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");

export function toLocalInput(value:string){const d=new Date(value);return localDate(d)+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
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

