-- CreateEnum
CREATE TYPE "schema_courtcontrolai"."ScheduleVerifyStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "schema_courtcontrolai"."ScheduleRun" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "solverStatus" TEXT NOT NULL,
    "verifiedStatus" "schema_courtcontrolai"."ScheduleVerifyStatus" NOT NULL DEFAULT 'PENDING',
    "violations" JSONB,
    "makespanMinutes" INTEGER,
    "assignmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleRun_tournamentId_createdAt_idx" ON "schema_courtcontrolai"."ScheduleRun"("tournamentId", "createdAt");

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."ScheduleRun" ADD CONSTRAINT "ScheduleRun_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "schema_courtcontrolai"."Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
