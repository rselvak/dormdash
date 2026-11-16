import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";

async function identity() {
  const { userId } = await auth();
  return userId ? getPrisma().parent.findUnique({ where: { clerkUserId: userId }, select: { id: true } }) : null;
}

export async function GET() {
  try {
    const parent = await identity();
    if (!parent) return NextResponse.json({ error: "Sign in and complete registration" }, { status: 401 });
    const prisma = getPrisma();
    const [notifications, unreadCount] = await Promise.all([
      prisma.eventNotification.findMany({ where: { parentId: parent.id }, orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 50, select: { id: true, readAt: true, createdAt: true, event: { select: { id: true, name: true, cancellationReason: true, cancelledAt: true } } } }),
      prisma.eventNotification.count({ where: { parentId: parent.id, readAt: null } }),
    ]);
    return NextResponse.json({ notifications, unreadCount }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Notifications failed", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const parent = await identity();
    if (!parent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    const result = await getPrisma().eventNotification.updateMany({ where: { id: parsed.data.id, parentId: parent.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    console.error("Notification update failed", error);
    return NextResponse.json({ error: "Unable to update notification" }, { status: 500 });
  }
}
