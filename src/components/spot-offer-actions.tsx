"use client";

import { useEffect, useState } from "react";
import { readApi } from "@/lib/event-ui";

export function SpotOfferActions({ eventId, participantId, version, expiresAt, onChanged }: { eventId: string; participantId: string; version: number; expiresAt?: string | null; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  async function respond(action: "accept" | "decline") {
    setBusy(true);setMessage("");
    try {
      await readApi(await fetch(`/api/events/${encodeURIComponent(eventId)}/offer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, version, participantId }) }));
      setMessage(action === "accept" ? "Your place is confirmed." : "You declined this spot.");
      await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to respond. Try again."); await onChanged(); }
    finally { setBusy(false); }
  }
  const expired = !!expiresAt && Date.parse(expiresAt) <= now;
  return <section className="space-y-3 rounded-xl border-2 border-accent bg-accent/5 p-4"><h3 className="font-semibold">{expired ? "Spot offer expired" : "A spot is reserved for you"}</h3><p className="text-sm">{expiresAt ? `Respond by ${new Date(expiresAt).toLocaleString()}.` : "Your response deadline is set when your offer email is prepared. You can also respond here now."} Your place becomes confirmed only after you accept.</p>{!expired && <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void respond("accept")} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">Accept spot</button><button type="button" disabled={busy} onClick={() => void respond("decline")} className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50">Decline spot</button></div>}{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
