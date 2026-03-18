/*
  Warnings:

  - A unique constraint covering the columns `[virtualAccountId]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "virtualAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_virtualAccountId_key" ON "Wallet"("virtualAccountId");
