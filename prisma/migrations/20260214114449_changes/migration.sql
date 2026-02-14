/*
  Warnings:

  - You are about to drop the column `UtilityBillNumber` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "UtilityBillNumber",
ADD COLUMN     "meterNumber" VARCHAR(100);
