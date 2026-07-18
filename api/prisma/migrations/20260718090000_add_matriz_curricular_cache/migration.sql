-- CreateTable
CREATE TABLE "MatrizCurricularCache" (
    "id" TEXT NOT NULL,
    "codCurso" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrizCurricularCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatrizCurricularCache_codCurso_key" ON "MatrizCurricularCache"("codCurso");
