CREATE TYPE "EventType" AS ENUM ('COLLEGE_PICKUP','COLLEGE_DROP_OFF','CARPOOL','VANPOOL','BUSPOOL','PACKAGE_DELIVERY','ANNOUNCEMENT');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','PUBLISHED');
CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  "dueAt" TIMESTAMP(3),
  "type" "EventType" NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
  "totalCostCents" INTEGER,
  "individualCostCents" INTEGER,
  "maxParticipants" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status","startsAt");
CREATE INDEX "Event_parentId_status_idx" ON "Event"("parentId","status");
ALTER TABLE "Event" ADD CONSTRAINT "Event_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
