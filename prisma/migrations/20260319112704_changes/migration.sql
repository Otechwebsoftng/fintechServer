/*
  Warnings:

  - You are about to drop the column `personIdNGN` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `personIdUSD` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[graphPersonId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_personIdNGN_key";

-- DropIndex
DROP INDEX "User_personIdUSD_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "personIdNGN",
DROP COLUMN "personIdUSD",
ADD COLUMN     "graphPersonId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_graphPersonId_key" ON "User"("graphPersonId");
