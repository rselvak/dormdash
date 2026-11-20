ALTER TABLE "Student" ADD COLUMN "verifyCollegeEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "collegeEmailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "emailVerificationTokenHash" TEXT;
ALTER TABLE "Student" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Student_emailVerificationTokenHash_key" ON "Student"("emailVerificationTokenHash");
