CREATE TABLE "EventParticipant" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventParticipant_eventId_parentId_key" ON "EventParticipant"("eventId", "parentId");
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");
CREATE INDEX "EventParticipant_parentId_idx" ON "EventParticipant"("parentId");
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Existing events: count their creators as participants immediately.
INSERT INTO "EventParticipant" ("id", "eventId", "parentId")
SELECT 'creator-' || "id", "id", "parentId" FROM "Event"
ON CONFLICT ("eventId", "parentId") DO NOTHING;
