-- CreateTable
CREATE TABLE "schema_courtcontrolai"."Registration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "categoryId" TEXT,
    "skillLevel" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'waived',
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_tournamentId_idx" ON "schema_courtcontrolai"."Registration"("tournamentId");

-- CreateIndex
CREATE INDEX "Registration_email_idx" ON "schema_courtcontrolai"."Registration"("email");

-- AddForeignKey
ALTER TABLE "schema_courtcontrolai"."Registration" ADD CONSTRAINT "Registration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "schema_courtcontrolai"."Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
