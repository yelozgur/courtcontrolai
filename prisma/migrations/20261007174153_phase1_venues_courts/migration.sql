-- CreateTable
CREATE TABLE "schema_courtcontrolai"."Venue" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_courtcontrolai"."Court" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venue_clubId_idx" ON "schema_courtcontrolai"."Venue"("clubId");

-- CreateIndex
CREATE INDEX "Court_venueId_idx" ON "schema_courtcontrolai"."Court"("venueId");

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Venue" ADD CONSTRAINT "Venue_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "schema_courtcontrolai"."Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Court" ADD CONSTRAINT "Court_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "schema_courtcontrolai"."Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
