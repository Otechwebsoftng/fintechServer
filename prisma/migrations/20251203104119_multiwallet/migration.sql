/*
  Warnings:

  - Made the column `currency` on table `Wallet` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Wallet_userId_key";

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "currency" SET NOT NULL;
