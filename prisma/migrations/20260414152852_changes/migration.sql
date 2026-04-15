/*
  Warnings:

  - You are about to drop the column `merchant_order_id` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `request_id` on the `Payment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Payment_request_id_key";

-- DropIndex
DROP INDEX "Payment_userId_reference_request_id_idx";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "merchant_order_id",
DROP COLUMN "request_id",
ALTER COLUMN "paymentMethod" SET DEFAULT 'BANK_TRANSFER';

-- CreateIndex
CREATE INDEX "Payment_userId_reference_idx" ON "Payment"("userId", "reference");
