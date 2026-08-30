-- CreateTable
CREATE TABLE "EcampusAnnouncementCache" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcampusAnnouncementCache_pkey" PRIMARY KEY ("id")
);
