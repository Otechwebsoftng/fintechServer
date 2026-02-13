/*
  Warnings:

  - You are about to drop the column `facialVerificationPublicId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `facialVerificationStatus` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `facialVerificationUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "facialVerificationPublicId",
DROP COLUMN "facialVerificationStatus",
DROP COLUMN "facialVerificationUrl";
