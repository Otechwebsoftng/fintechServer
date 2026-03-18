/*
  Warnings:

  - You are about to drop the column `bankName` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "bankName",
ADD COLUMN     "bank_id_number" VARCHAR(100);
