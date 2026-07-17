-- CreateEnum
CREATE TYPE "GlobalDataType" AS ENUM ('ACADEMIC_CALENDAR', 'INSTITUTIONAL_INFO', 'RU_MENU', 'OFFICIAL_NOTICE');

-- CreateTable
CREATE TABLE "GlobalData" (
    "id" TEXT NOT NULL,
    "type" "GlobalDataType" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalData_type_active_idx" ON "GlobalData"("type", "active");
