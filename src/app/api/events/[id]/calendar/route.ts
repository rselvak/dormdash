import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { collegeKey } from "@/lib/college";
import { eventCalendarFile } from "@/lib/event-calendar";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prisma = getPrisma();
    const parent = await prisma.parent.findUnique({ where: { clerkUserId: userId }, select: { id: true, students: { select: { college: true } } } });
    if (!parent) return NextResponse.json({ error: "Complete registration first" }, { status: 403 });
    const { id } = await params;
    const event = await prisma.event.findUnique({ where: { id }, include: { participants: { where: { parentId: parent.id }, select: { parentId: true } } } });
    if (!event || (event.parentId !== parent.id && !((event.status === "PUBLISHED" || event.status === "CANCELLED") && event.participants?.length) && ((event.status !== "PUBLISHED" && event.status !== "CANCELLED") || !event.collegeKey || !parent.students.some(student => collegeKey(student.college) === event.collegeKey)))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const eventUrl = new URL("/", request.url);
    eventUrl.searchParams.set("event", event.id);
    const safeName = event.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim().slice(0,100) || "Event";
    return new NextResponse(eventCalendarFile(event, eventUrl.toString()), { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="dormdash-event.ics"; filename*=UTF-8''${encodeURIComponent(safeName + ".ics").replace(/'/g,"%27")}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Calendar download failed", error);
    return NextResponse.json({ error: "Unable to download event calendar" }, { status: 500 });
  }
}
