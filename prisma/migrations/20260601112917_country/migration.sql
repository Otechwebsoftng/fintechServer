/*
  Warnings:

  - Added the required column `country` to the `Beneficiary` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Beneficiary" ADD COLUMN     "country" TEXT NOT NULL;
