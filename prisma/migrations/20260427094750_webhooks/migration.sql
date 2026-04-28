/*
  Warnings:

  - You are about to drop the column `authorization` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `customer` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `domain` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `failed_at` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `fees` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `gateway_response` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `log` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Webhook` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `Webhook` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Webhook_id_reference_idx";

-- AlterTable
ALTER TABLE "Webhook" DROP COLUMN "authorization",
DROP COLUMN "channel",
DROP COLUMN "customer",
DROP COLUMN "domain",
DROP COLUMN "failed_at",
DROP COLUMN "fees",
DROP COLUMN "gateway_response",
DROP COLUMN "ip_address",
DROP COLUMN "log",
DROP COLUMN "message",
DROP COLUMN "metadata",
DROP COLUMN "reference",
ADD COLUMN     "account_id" TEXT,
ADD COLUMN     "bank_account" JSONB,
ADD COLUMN     "deposit" JSONB,
ADD COLUMN     "deposit_id" TEXT,
ADD COLUMN     "fee" DOUBLE PRECISION,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "transactionId" TEXT,
ADD COLUMN     "type" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_transactionId_key" ON "Webhook"("transactionId");

-- CreateIndex
CREATE INDEX "Webhook_id_idx" ON "Webhook"("id");
