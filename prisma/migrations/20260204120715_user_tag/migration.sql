/*
  Warnings:

  - A unique constraint covering the columns `[userTag]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "userTag" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_userTag_key" ON "User"("userTag");
