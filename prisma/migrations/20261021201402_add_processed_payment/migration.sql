-- CreateTable
CREATE TABLE "ProcessedPayment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedPayment_sessionId_key" ON "ProcessedPayment"("sessionId");

-- CreateIndex
CREATE INDEX "ProcessedPayment_invoiceId_idx" ON "ProcessedPayment"("invoiceId");
