-- CreateTable
CREATE TABLE "ProcessedRefund" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedRefund_refundId_key" ON "ProcessedRefund"("refundId");

-- CreateIndex
CREATE INDEX "ProcessedRefund_chargeId_idx" ON "ProcessedRefund"("chargeId");
