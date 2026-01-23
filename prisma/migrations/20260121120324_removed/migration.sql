/*
  Warnings:

  - You are about to drop the column `balanceAfter` on the `WalletTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `balanceBefore` on the `WalletTransaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WalletTransaction" DROP COLUMN "balanceAfter",
DROP COLUMN "balanceBefore";
