/*
  Warnings:

  - You are about to alter the column `percentage` on the `TransactionCharge` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.
  - You are about to alter the column `fixedAmount` on the `TransactionCharge` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE "TransactionCharge" ALTER COLUMN "percentage" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "fixedAmount" SET DATA TYPE DECIMAL(12,2);
