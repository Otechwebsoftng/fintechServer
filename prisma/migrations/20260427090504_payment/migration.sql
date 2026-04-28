/*
  Warnings:

  - You are about to drop the column `metadata` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Payment_reference_key";

-- DropIndex
DROP INDEX "Payment_userId_reference_idx";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "metadata",
DROP COLUMN "reference",
ADD COLUMN     "amountSettled" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "deposit" JSONB,
ADD COLUMN     "fee" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "transactionId" TEXT,
ADD COLUMN     "type" VARCHAR(50),
ADD COLUMN     "virtualAccountId" VARCHAR(100),
ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "WalletTransaction" ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "amount" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_userId_transactionId_virtualAccountId_idx" ON "Payment"("userId", "transactionId", "virtualAccountId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "Wallet"("virtualAccountId") ON DELETE SET NULL ON UPDATE CASCADE;
