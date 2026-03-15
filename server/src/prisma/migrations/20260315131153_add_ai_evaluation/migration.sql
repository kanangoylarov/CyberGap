-- CreateTable
CREATE TABLE "ai_evaluations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" VARCHAR(20),
    "summary" TEXT,
    "categoryScores" TEXT,
    "gaps" TEXT,
    "recommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
