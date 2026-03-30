/*
  Warnings:

  - A unique constraint covering the columns `[Tier2IdNo]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "Tier2IdNo" TEXT,
ADD COLUMN     "Tier2IdType" "IdentityType" DEFAULT 'PASSPORT';

-- CreateIndex
CREATE UNIQUE INDEX "User_Tier2IdNo_key" ON "User"("Tier2IdNo");
