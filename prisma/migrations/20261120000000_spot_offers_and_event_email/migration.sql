ALTER TYPE "ParticipationStatus" ADD VALUE 'OFFERED';
ALTER TYPE "ParticipationStatus" ADD VALUE 'DECLINED';
ALTER TYPE "ParticipationStatus" ADD VALUE 'EXPIRED';
ALTER TABLE "Event" ADD COLUMN "waitingListCheckedAt" TIMESTAMP(3);
ALTER TABLE "EventParticipant" ADD COLUMN "offerVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "offerCreatedAt" TIMESTAMP(3), ADD COLUMN "offerSentAt" TIMESTAMP(3), ADD COLUMN "offerExpiresAt" TIMESTAMP(3);
CREATE TABLE "EventEmail" (
  "id" TEXT NOT NULL, "uniqueKey" TEXT NOT NULL, "eventId" TEXT NOT NULL, "parentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "participantId" TEXT, "offerVersion" INTEGER, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "sentAt" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EventEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventEmail_uniqueKey_key" ON "EventEmail"("uniqueKey");
CREATE INDEX "EventEmail_status_availableAt_idx" ON "EventEmail"("status", "availableAt");
CREATE INDEX "EventEmail_eventId_kind_idx" ON "EventEmail"("eventId", "kind");
ALTER TABLE "EventEmail" ADD CONSTRAINT "EventEmail_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventEmail" ADD CONSTRAINT "EventEmail_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
