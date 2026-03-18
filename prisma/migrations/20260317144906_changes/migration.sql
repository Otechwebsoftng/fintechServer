/*
  Warnings:

  - You are about to drop the column `personId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[personIdNGN]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personIdUSD]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_personId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "personId",
ADD COLUMN     "personIdNGN" TEXT,
ADD COLUMN     "personIdUSD" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_personIdNGN_key" ON "User"("personIdNGN");

-- CreateIndex
CREATE UNIQUE INDEX "User_personIdUSD_key" ON "User"("personIdUSD");
