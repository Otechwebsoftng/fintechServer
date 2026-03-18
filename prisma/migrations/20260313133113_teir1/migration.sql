/*
  Warnings:

  - A unique constraint covering the columns `[Tier1idNo]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "Tier1idNo" TEXT,
ADD COLUMN     "Tier1idType" "IdentityType" DEFAULT 'NIN';

-- CreateIndex
CREATE UNIQUE INDEX "User_Tier1idNo_key" ON "User"("Tier1idNo");
