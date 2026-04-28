/*
  Warnings:

  - You are about to drop the column `transactionId` on the `Webhook` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Webhook_transactionId_key";

-- AlterTable
ALTER TABLE "Webhook" DROP COLUMN "transactionId";
