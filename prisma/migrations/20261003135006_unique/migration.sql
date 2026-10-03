/*
  Warnings:

  - A unique constraint covering the columns `[userId,currency,network]` on the table `CryptoAddress` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CryptoAddress_userId_currency_network_key" ON "CryptoAddress"("userId", "currency", "network");
