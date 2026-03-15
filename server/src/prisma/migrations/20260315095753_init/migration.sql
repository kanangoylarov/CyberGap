-- CreateTable
CREATE TABLE "audit_response_logs" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "oldAnswer" BOOLEAN NOT NULL,
    "oldComment" TEXT,
    "oldFilePath" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_response_logs_pkey" PRIMARY KEY ("id")
);
