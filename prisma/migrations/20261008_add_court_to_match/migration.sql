-- AlterTable
ALTER TABLE "schema_courtcontrolai"."Match" ADD COLUMN "courtId" TEXT;

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Match" ADD CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "schema_courtcontrolai"."Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;
