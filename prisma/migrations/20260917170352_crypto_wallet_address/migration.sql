/*
  Warnings:

  - You are about to drop the column `providerAddressId` on the `CryptoAddress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[walletAddress]` on the table `CryptoAddress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `walletAddress` to the `CryptoAddress` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CryptoAddress_providerAddressId_key";

-- DropIndex
DROP INDEX "CryptoAddress_providerAddressId_userId_idx";

-- AlterTable
ALTER TABLE "CryptoAddress" DROP COLUMN "providerAddressId",
ADD COLUMN     "walletAddress" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CryptoAddress_walletAddress_key" ON "CryptoAddress"("walletAddress");

-- CreateIndex
CREATE INDEX "CryptoAddress_walletAddress_userId_idx" ON "CryptoAddress"("walletAddress", "userId");
