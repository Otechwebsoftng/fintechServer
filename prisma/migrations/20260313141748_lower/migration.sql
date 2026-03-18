/*
  Warnings:

  - You are about to drop the column `Tier1idNo` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `Tier1idType` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `Tier1idVerified` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tier1idNo]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_Tier1idNo_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "Tier1idNo",
DROP COLUMN "Tier1idType",
DROP COLUMN "Tier1idVerified",
ADD COLUMN     "tier1idNo" TEXT,
ADD COLUMN     "tier1idType" "IdentityType" DEFAULT 'NIN',
ADD COLUMN     "tier1idVerified" "DocumentVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED';

-- CreateIndex
CREATE UNIQUE INDEX "User_tier1idNo_key" ON "User"("tier1idNo");
