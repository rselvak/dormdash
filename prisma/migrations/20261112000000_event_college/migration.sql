ALTER TABLE "Event" ADD COLUMN "college" TEXT;
ALTER TABLE "Event" ADD COLUMN "collegeKey" TEXT;
CREATE INDEX "Event_collegeKey_status_startsAt_idx" ON "Event"("collegeKey", "status", "startsAt");
-- Existing events remain unassigned until their creators select a college.
