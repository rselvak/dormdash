CREATE TYPE "TripService" AS ENUM ('PACKAGE_DELIVERY', 'PASSENGER_TRANSPORT');
ALTER TABLE "Event" ADD COLUMN "services" "TripService"[] NOT NULL DEFAULT ARRAY[]::"TripService"[];
ALTER TABLE "EventParticipant" ADD COLUMN "requestedServices" "TripService"[] NOT NULL DEFAULT ARRAY[]::"TripService"[];
UPDATE "Event" SET "services" = ARRAY['PASSENGER_TRANSPORT']::"TripService"[] WHERE "type" = 'COLLEGE_PICKUP';
