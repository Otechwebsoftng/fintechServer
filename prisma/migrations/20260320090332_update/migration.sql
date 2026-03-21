/*
  Warnings:

  - You are about to drop the column `identityTypePublicId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `identityTypeUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "identityTypePublicId",
DROP COLUMN "identityTypeUrl",
ADD COLUMN     "identityTypeTier2PublicId" TEXT,
ADD COLUMN     "identityTypeTier2Url" TEXT;
