/*
  Warnings:

  - You are about to drop the column `bankIdNumber` on the `Wallet` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[personId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "personId" TEXT;

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "bankIdNumber",
ADD COLUMN     "bankName" VARCHAR(100),
ADD COLUMN     "holderId" TEXT,
ADD COLUMN     "holderType" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");
