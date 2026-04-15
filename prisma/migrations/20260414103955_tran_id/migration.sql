/*
  Warnings:

  - You are about to drop the column `balance` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "balance";

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "transactionId" TEXT;
