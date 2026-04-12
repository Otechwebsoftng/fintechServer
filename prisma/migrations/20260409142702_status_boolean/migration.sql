/*
  Warnings:

  - The `bvnVerified` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `identityVerificationStatus` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tier1idVerified` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "bvnVerified",
ADD COLUMN     "bvnVerified" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "identityVerificationStatus",
ADD COLUMN     "identityVerificationStatus" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "tier1idVerified",
ADD COLUMN     "tier1idVerified" BOOLEAN NOT NULL DEFAULT false;
