-- CreateEnum
CREATE TYPE "CommunityCategory" AS ENUM ('BOLSA', 'ENERGIA', 'FILA_RU', 'COMIDAS', 'ALUGUEIS', 'TROCAS_VENDAS', 'EVENTOS', 'PALESTRAS', 'FORMATURAS', 'ACHADOS_PERDIDOS', 'EMPREGOS', 'ESTAGIO', 'PESQUISA');

-- CreateEnum
CREATE TYPE "CommunityPostStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "category" "CommunityCategory" NOT NULL,
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'PENDING',
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "confirmCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityConfirmation" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityPost_status_category_createdAt_idx" ON "CommunityPost"("status", "category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityConfirmation_postId_userId_key" ON "CommunityConfirmation"("postId", "userId");

-- AddForeignKey
ALTER TABLE "CommunityConfirmation" ADD CONSTRAINT "CommunityConfirmation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
