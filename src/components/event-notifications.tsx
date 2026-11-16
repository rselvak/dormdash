"use client";

import { useCallback, useEffect, useState } from "react";
import { readApi } from "@/lib/event-ui";

type Notification = { id: string; readAt: string | null; createdAt: string; event: { id: string; name: string; cancellationReason: string | null } };

export function EventNotifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) { setNotifications([]); setUnread(0); return; }
      const data = await readApi(response);
      setNotifications(data.notifications); setUnread(data.unreadCount); setError("");
    } catch { setError("Could not load notifications. Please try again."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [refresh]);

  async function markRead(id: string) {
    try {
      await readApi(await fetch("/api/notifications", { method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }));
      await refresh();
    } catch { setError("Could not mark this notification as read."); }
  }

  return <div className="relative">
    <button type="button" aria-expanded={open} aria-controls="event-notifications" onClick={() => { setOpen(!open); if (!open) void refresh(); }} className="rounded-full border border-border px-3 py-2 text-xs font-medium">Notifications{unread > 0 ? ` (${unread})` : ""}</button>
    {open && <section id="event-notifications" aria-label="Event notifications" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} className="absolute right-0 top-full mt-2 max-h-[70vh] w-[min(22rem,85vw)] overflow-y-auto rounded-xl border-2 border-border bg-background p-4 shadow-xl">
      <div className="flex justify-between gap-3"><h2 className="font-semibold">Notifications</h2><button type="button" onClick={() => setOpen(false)} className="text-sm underline">Close</button></div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}<button type="button" onClick={() => void refresh()} className="ml-2 underline">Retry</button></p>}
      {loading ? <p className="mt-3 text-sm text-muted">Loading notifications…</p> : !error && notifications.length === 0 && <p className="mt-3 text-sm text-muted">No notifications yet.</p>}
      <div className="mt-3 space-y-3">{notifications.map(notification => <article key={notification.id} className={`rounded-lg border p-3 ${notification.readAt ? "border-border" : "border-red-500 bg-red-50 dark:bg-red-950/20"}`}>
        <p className="text-sm font-semibold">Cancelled: {notification.event.name}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{notification.event.cancellationReason}</p>
        <p className="mt-2 text-xs text-muted">{new Date(notification.createdAt).toLocaleString()}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm"><a href={`/?event=${encodeURIComponent(notification.event.id)}`} onClick={() => { setOpen(false); void markRead(notification.id); }} className="underline">View event</a>{!notification.readAt && <button type="button" onClick={() => void markRead(notification.id)} className="underline">Mark as read</button>}</div>
      </article>)}</div>
    </section>}
  </div>;
}
