/*
  Warnings:

  - A unique constraint covering the columns `[userId,accountNumber,currency]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Wallet_userId_currency_key";

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_accountNumber_currency_key" ON "Wallet"("userId", "accountNumber", "currency");
