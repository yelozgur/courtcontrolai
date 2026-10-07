-- AlterTable
ALTER TABLE "schema_courtcontrolai"."Match" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "schema_courtcontrolai"."CheckIn" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'qr',
    "scannedBy" TEXT,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_courtcontrolai"."Category" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "gender" TEXT,
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "matchMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckIn_registrationId_idx" ON "schema_courtcontrolai"."CheckIn"("registrationId");

-- CreateIndex
CREATE INDEX "CheckIn_scannedAt_idx" ON "schema_courtcontrolai"."CheckIn"("scannedAt");

-- CreateIndex
CREATE INDEX "Category_tournamentId_idx" ON "schema_courtcontrolai"."Category"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tournamentId_slug_key" ON "schema_courtcontrolai"."Category"("tournamentId", "slug");

-- CreateIndex
CREATE INDEX "Match_categoryId_idx" ON "schema_courtcontrolai"."Match"("categoryId");

-- CreateIndex
CREATE INDEX "Registration_categoryId_idx" ON "schema_courtcontrolai"."Registration"("categoryId");

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Registration" ADD CONSTRAINT "Registration_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "schema_courtcontrolai"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."CheckIn" ADD CONSTRAINT "CheckIn_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "schema_courtcontrolai"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Category" ADD CONSTRAINT "Category_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "schema_courtcontrolai"."Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Match" ADD CONSTRAINT "Match_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "schema_courtcontrolai"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
