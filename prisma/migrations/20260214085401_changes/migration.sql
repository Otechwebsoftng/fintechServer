/*
  Warnings:

  - You are about to drop the column `issusedCountry` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "issusedCountry",
ADD COLUMN     "issuedCountry" VARCHAR(50),
ADD COLUMN     "issuedPlace" VARCHAR(50);
