-- CreateTable
CREATE TABLE "MoodleAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoodleAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoodleAccountLink_userId_idx" ON "MoodleAccountLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MoodleAccountLink_userId_instanceId_key" ON "MoodleAccountLink"("userId", "instanceId");
