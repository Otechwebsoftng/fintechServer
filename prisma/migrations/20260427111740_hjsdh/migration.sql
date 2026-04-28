/*
  Warnings:

  - A unique constraint covering the columns `[payoutId]` on the table `WalletTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WalletTransaction_walletId_reference_idempotencyKey_linkedT_idx";

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_payoutId_key" ON "WalletTransaction"("payoutId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_reference_idempotencyKey_payoutI_idx" ON "WalletTransaction"("walletId", "reference", "idempotencyKey", "payoutId", "linkedTxId");
