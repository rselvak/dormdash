import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { emailAppUrl } from "@/lib/email-app-url";
import { DELIVERY_WINDOW_MS, offerCutoff, offerDeadline } from "@/lib/spot-offer-policy";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
type EmailEvent = { id: string; name: string; startsAt: Date; allDay: boolean; timeZone: string; cancellationReason: string | null; endsAt: Date | null; dueAt: Date | null };
export function eventEmailContent(kind: string, event: EmailEvent, base: string, version?: number | null, participantId?: string | null, expiresAt?: Date | null) {
  const when = event.startsAt.toLocaleString("en-US", { timeZone: event.timeZone, dateStyle: "full", ...(event.allDay ? {} : { timeStyle: "short" as const }) });
  const link = new URL(kind === "CANCELLED" ? "/" : `/offers/${encodeURIComponent(event.id)}`, base);
  if (kind === "CANCELLED") link.searchParams.set("event", event.id);
  else { link.searchParams.set("version", String(version)); link.searchParams.set("participant", participantId || ""); }
  if (kind === "CANCELLED") {
    const text = `${event.name} has been cancelled.\n${when}\nReason: ${event.cancellationReason || "Contact the organizer for details."}\nView event: ${link}`;
    return { subject: `Cancelled: ${event.name}`, textContent: text, htmlContent: `<h2>Event cancelled</h2><p>${escape(event.name)}</p><p>${escape(when)}</p><p style="white-space:pre-wrap">Reason: ${escape(event.cancellationReason || "Contact the organizer for details.")}</p><p><a href="${escape(link.toString())}">View event</a></p>` };
  }
  const accept = new URL(link); accept.searchParams.set("intent", "accept");
  const decline = new URL(link); decline.searchParams.set("intent", "decline");
  const deadline = expiresAt?.toLocaleString("en-US", { timeZone: event.timeZone, dateStyle: "full", timeStyle: "long" });
  const instruction = deadline ? `Accept or decline by ${deadline} (${event.timeZone}).` : "Open the app to see your response deadline.";
  return { subject: `Spot offered: ${event.name}`, textContent: `A spot is reserved for you in ${event.name}.\n${when}\n${instruction}\nAccept: ${accept}\nDecline: ${decline}\nSign in and confirm your choice. Opening a link does not accept or decline.`, htmlContent: `<h2>A spot is available</h2><p>${escape(event.name)}</p><p>${escape(when)}</p><p>${escape(instruction)}</p><p><a href="${escape(accept.toString())}">Accept spot</a> &nbsp; <a href="${escape(decline.toString())}">Decline spot</a></p><p>Sign in and confirm your choice. Opening a link does not accept or decline the offer.</p>` };
}

// Durable outbox with a short lease. Provider idempotency keys reduce duplicate
// delivery if the API succeeds but the worker loses its response.
export async function dispatchEventEmails(eventId?: string, limit = 5) {
  const key = process.env.BREVO_API_KEY, sender = process.env.BREVO_SENDER_EMAIL, base = emailAppUrl();
  if (!key || !sender || !base) return { sent: 0, configured: false };
  const db = getPrisma();
  const now = new Date();
  const eligible = { OR: [{ status: "PENDING", availableAt: { lte: now } }, { status: "SENDING", leaseUntil: { lt: now } }] };
  const jobs = await db.eventEmail.findMany({ where: { ...eligible, ...(eventId ? { eventId } : {}) }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  let sent = 0;
  // Keep each batch within the hosting function's execution limit.
  for (let offset = 0; offset < jobs.length; offset += 5) await Promise.all(jobs.slice(offset, offset + 5).map(async ({ id }) => {
    const leaseToken = randomUUID();
    const claim = await db.eventEmail.updateMany({ where: { id, ...eligible }, data: { status: "SENDING", leaseToken, leaseUntil: new Date(Date.now() + 120000), attempts: { increment: 1 } } });
    if (!claim.count) return;
    const job = await db.eventEmail.findUniqueOrThrow({ where: { id }, include: { parent: { select: { email: true } }, event: true } });
    const finish = (status: string) => db.eventEmail.updateMany({ where: { id, leaseToken, status: "SENDING" }, data: { status, leaseToken: null, leaseUntil: null } });
    if (job.kind === "SPOT_OFFERED") {
      const participant = job.participantId ? await db.eventParticipant.findUnique({ where: { id: job.participantId } }) : null;
      if (job.event.status !== "PUBLISHED" || !participant || participant.status !== "OFFERED" || participant.offerVersion !== job.offerVersion || offerCutoff(job.event).getTime() <= Date.now() || (participant.offerCreatedAt && participant.offerCreatedAt.getTime() + DELIVERY_WINDOW_MS <= Date.now()) || (participant.offerExpiresAt && participant.offerExpiresAt.getTime() <= Date.now())) { await finish("CANCELLED"); return; }
    } else if (job.kind !== "CANCELLED" || job.event.status !== "CANCELLED") { await finish("CANCELLED"); return; }
    let failure = "Delivery failed";
    let throttled = false;
    try {
      // Freeze the exact deadline before sending so the email, app and retries agree.
      const prepared = job.kind === "SPOT_OFFERED" ? await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${job.eventId} FOR UPDATE`;
        const event = await tx.event.findUnique({ where: { id: job.eventId } });
        const participant = await tx.eventParticipant.findUnique({ where: { id: job.participantId! } });
        const now = new Date();
        if (!event || event.status !== "PUBLISHED" || !participant || participant.status !== "OFFERED" || participant.offerVersion !== job.offerVersion || offerCutoff(event) <= now || (participant.offerExpiresAt && participant.offerExpiresAt <= now)) return null;
        const awaiting = await tx.eventParticipant.count({ where: { eventId: job.eventId, status: { in: ["WAITLISTED", "OFFERED"] } } });
        const expiresAt = participant.offerExpiresAt ?? offerDeadline(event, now, awaiting);
        if (expiresAt <= now) return null;
        if (!participant.offerExpiresAt) await tx.eventParticipant.update({ where: { id: participant.id }, data: { offerExpiresAt: expiresAt } });
        return { event, expiresAt };
      }) : { event: job.event, expiresAt: null };
      if (!prepared) { await finish("CANCELLED"); return; }
      const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": key, "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ sender: { email: sender, name: process.env.BREVO_SENDER_NAME || "DormDash" }, to: [{ email: job.parent.email }], headers: { idempotencyKey: job.id }, ...eventEmailContent(job.kind, prepared.event, base, job.offerVersion, job.participantId, prepared.expiresAt) }) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // Brevo confirms an earlier identical request with this response.
        if (response.status !== 400 || error.code !== "duplicate_parameter") { failure = `Provider HTTP ${response.status}`; throttled = response.status === 429; throw new Error(failure); }
      }
      const delivered = new Date();
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${job.eventId} FOR UPDATE`;
        const acknowledged = await tx.eventEmail.updateMany({ where: { id, leaseToken, status: "SENDING" }, data: { status: "SENT", sentAt: delivered, lastError: null, leaseToken: null, leaseUntil: null } });
        const currentEvent = await tx.event.findUnique({ where: { id: job.eventId } });
        if (acknowledged.count && currentEvent?.status === "PUBLISHED" && job.kind === "SPOT_OFFERED" && job.participantId) await tx.eventParticipant.updateMany({ where: { id: job.participantId, status: "OFFERED", offerVersion: job.offerVersion! }, data: { offerSentAt: delivered } });
      });
      sent++;
    } catch {
      const delay = throttled ? 3600000 : Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7));
      await db.eventEmail.updateMany({ where: { id, leaseToken, status: "SENDING" }, data: { status: "PENDING", lastError: failure, availableAt: new Date(Date.now() + delay), leaseUntil: null, leaseToken: null } });
    }
  }));
  return { sent, configured: true };
}

export async function flushEventEmails(eventId: string) {
  try { await dispatchEventEmails(eventId); }
  catch { console.warn("Event notification emails remain queued for retry."); }
}
