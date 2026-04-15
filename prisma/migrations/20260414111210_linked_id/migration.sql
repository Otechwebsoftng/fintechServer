/*
  Warnings:

  - A new column `linkedTxId` is being added to the `WalletTransaction` table without a default value. This is required if there are existing rows.

*/
-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "linkedTxId" TEXT;

-- CreateIndex
CREATE INDEX "WalletTransaction_linkedTxId_idx" ON "WalletTransaction"("linkedTxId");
