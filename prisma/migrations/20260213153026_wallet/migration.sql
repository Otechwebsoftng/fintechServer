/*
  Warnings:

  - A unique constraint covering the columns `[accountNumber]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `status` on the `Wallet` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" VARCHAR(100),
ADD COLUMN     "channelReference" VARCHAR(64),
ADD COLUMN     "merchantReference" VARCHAR(64),
DROP COLUMN "status",
ADD COLUMN     "status" "WalletStatus" NOT NULL;

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "domain" TEXT,
    "status" TEXT,
    "reference" TEXT,
    "amount" DOUBLE PRECISION,
    "message" TEXT,
    "gateway_response" TEXT,
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "channel" TEXT,
    "currency" TEXT,
    "ip_address" TEXT,
    "metadata" JSONB,
    "log" JSONB,
    "fees" DOUBLE PRECISION,
    "customer" JSONB,
    "authorization" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "walletId" TEXT,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Webhook_id_reference_idx" ON "Webhook"("id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_accountNumber_key" ON "Wallet"("accountNumber");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
