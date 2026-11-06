-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "estimatedDelivery" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "shippedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "cancelledAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_businessId_idx" ON "Order"("businessId");
