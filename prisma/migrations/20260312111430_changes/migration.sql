/*
  Warnings:

  - You are about to drop the column `virtualAccountId` on the `Wallet` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Wallet_virtualAccountId_key";

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "virtualAccountId";
