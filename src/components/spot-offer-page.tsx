"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { readApi, eventDateLabel, type CalendarEvent } from "@/lib/event-ui";
import { SpotOfferActions } from "@/components/spot-offer-actions";

export function SpotOfferPage({ eventId, participantId, version, intent }: { eventId: string; participantId: string; version: number; intent?: string }) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const body = await readApi(await fetch(`/api/events/${encodeURIComponent(eventId)}`, { cache: "no-store" }));setEvent(body.event);setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load offer"); }
  }, [eventId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <div className="space-y-5">{error && <p role="alert">{error}</p>}{!event&&!error&&<p>Loading offer…</p>}{event&&<><h2 className="text-xl font-semibold">{event.name}</h2><p className="text-sm text-muted">{eventDateLabel(event)}</p>{event.status!=="PUBLISHED"?<p>This event is no longer accepting offers.{event.cancellationReason&&` Reason: ${event.cancellationReason}`}</p>:event.participantId!==participantId||event.offerVersion!==version?<p>This link is from an older offer. Open My Events to see your current status.</p>:event.participationStatus==="OFFERED"?<><p className="text-sm">{intent==="decline"?"To decline, confirm using the button below.":"Choose whether to accept or decline your reserved place."}</p><SpotOfferActions participantId={participantId} eventId={eventId} version={version} expiresAt={event.offerExpiresAt} onChanged={load}/></>:<p>{event.participationStatus==="ACCEPTED"?"Your place is confirmed.":event.participationStatus==="DECLINED"?"You declined this offer.":"This offer has expired or is no longer available."}</p>}</>}<Link href="/my-events" className="inline-block text-sm text-accent underline">Go to My Events</Link></div>;
}
