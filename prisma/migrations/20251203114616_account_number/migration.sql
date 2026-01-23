/*
  Warnings:

  - A unique constraint covering the columns `[accountNumber]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "accountNumber" VARCHAR(10);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_accountNumber_key" ON "Wallet"("accountNumber");
