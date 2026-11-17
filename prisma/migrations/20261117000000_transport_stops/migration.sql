ALTER TABLE "Event" ADD COLUMN "transportType" TEXT;
ALTER TABLE "Event" ADD COLUMN "busStops" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EventParticipant" ADD COLUMN "selectedStop" TEXT;
-- Preserve the meaning of existing Amtrak events without changing their stored enum.
UPDATE "Event" SET "transportType" = 'TRAIN' WHERE "type" = 'VANPOOL';
