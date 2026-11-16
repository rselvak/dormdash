ALTER TYPE "EventStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "Event" ADD COLUMN "cancellationReason" TEXT, ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE TABLE "EventNotification" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "EventNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventNotification_eventId_parentId_key" ON "EventNotification"("eventId", "parentId");
CREATE INDEX "EventNotification_parentId_readAt_createdAt_idx" ON "EventNotification"("parentId", "readAt", "createdAt");
ALTER TABLE "EventNotification" ADD CONSTRAINT "EventNotification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventNotification" ADD CONSTRAINT "EventNotification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
