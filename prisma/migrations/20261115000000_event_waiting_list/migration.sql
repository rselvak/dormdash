CREATE TYPE "ParticipationStatus" AS ENUM ('ACCEPTED', 'WAITLISTED');
ALTER TABLE "Event"
  ADD COLUMN "waitingListAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxWaitingList" INTEGER,
  ADD CONSTRAINT "Event_maxWaitingList_check" CHECK ("maxWaitingList" IS NULL OR "maxWaitingList" >= 0);
ALTER TABLE "EventParticipant" ADD COLUMN "status" "ParticipationStatus" NOT NULL DEFAULT 'ACCEPTED';
CREATE INDEX "EventParticipant_eventId_status_joinedAt_id_idx" ON "EventParticipant"("eventId", "status", "joinedAt", "id");
