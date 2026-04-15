/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `WalletTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WalletTransaction_linkedTxId_idx";

-- DropIndex
DROP INDEX "WalletTransaction_reference_idx";

-- DropIndex
DROP INDEX "WalletTransaction_walletId_idx";

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_reference_idempotencyKey_linkedT_idx" ON "WalletTransaction"("walletId", "reference", "idempotencyKey", "linkedTxId");
