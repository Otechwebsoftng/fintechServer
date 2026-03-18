/*
  Warnings:

  - You are about to drop the column `bank_id_number` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "bank_id_number",
ADD COLUMN     "bankIdNumber" VARCHAR(100);
