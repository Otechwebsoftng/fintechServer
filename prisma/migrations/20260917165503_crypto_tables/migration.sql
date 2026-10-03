/*
  Warnings:

  - You are about to drop the column `address` on the `CryptoAddress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerAddressId]` on the table `CryptoAddress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `network` to the `CryptoAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerAddressId` to the `CryptoAddress` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CryptoProvider" AS ENUM ('OBIEX');

-- DropIndex
DROP INDEX "CryptoAddress_address_idx";

-- DropIndex
DROP INDEX "CryptoAddress_address_key";

-- AlterTable
ALTER TABLE "CryptoAddress" DROP COLUMN "address",
ADD COLUMN     "network" TEXT NOT NULL,
ADD COLUMN     "provider" "CryptoProvider" NOT NULL DEFAULT 'OBIEX',
ADD COLUMN     "providerAddressId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" TEXT NOT NULL,
    "cryptoPaymentId" TEXT,
    "network" TEXT NOT NULL,
    "currency" "CryptoCurrency" NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionType" "PaymentEntry" NOT NULL,
    "provider" "CryptoProvider" NOT NULL DEFAULT 'OBIEX',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "cryptoAddressId" TEXT,
    "address" TEXT,
    "reference" TEXT,
    "currency" "CryptoCurrency" NOT NULL,
    "network" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "amountReceived" DECIMAL(36,18),
    "fee" DECIMAL(36,18),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "hash" TEXT,
    "provider" "CryptoProvider" NOT NULL,
    "detectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoTransaction_cryptoPaymentId_key" ON "CryptoTransaction"("cryptoPaymentId");

-- CreateIndex
CREATE INDEX "CryptoTransaction_toAddress_idx" ON "CryptoTransaction"("toAddress");

-- CreateIndex
CREATE INDEX "CryptoTransaction_fromAddress_idx" ON "CryptoTransaction"("fromAddress");

-- CreateIndex
CREATE INDEX "CryptoTransaction_status_idx" ON "CryptoTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoPayment_reference_key" ON "CryptoPayment"("reference");

-- CreateIndex
CREATE INDEX "CryptoPayment_hash_userId_reference_cryptoAddressId_idx" ON "CryptoPayment"("hash", "userId", "reference", "cryptoAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoAddress_providerAddressId_key" ON "CryptoAddress"("providerAddressId");

-- CreateIndex
CREATE INDEX "CryptoAddress_providerAddressId_userId_idx" ON "CryptoAddress"("providerAddressId", "userId");

-- AddForeignKey
ALTER TABLE "CryptoTransaction" ADD CONSTRAINT "CryptoTransaction_cryptoPaymentId_fkey" FOREIGN KEY ("cryptoPaymentId") REFERENCES "CryptoPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoPayment" ADD CONSTRAINT "CryptoPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoPayment" ADD CONSTRAINT "CryptoPayment_cryptoAddressId_fkey" FOREIGN KEY ("cryptoAddressId") REFERENCES "CryptoAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
