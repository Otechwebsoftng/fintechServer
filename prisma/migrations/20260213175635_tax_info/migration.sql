/*
  Warnings:

  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isTaxAddressCompleted` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `nationality` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `streetNo` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `taxCountry` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `taxNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "isTaxAddressCompleted",
DROP COLUMN "nationality",
DROP COLUMN "state",
DROP COLUMN "street",
DROP COLUMN "streetNo",
DROP COLUMN "taxCountry",
DROP COLUMN "taxNumber",
DROP COLUMN "zipCode";

-- CreateTable
CREATE TABLE "TaxAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" VARCHAR(50) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "street" VARCHAR(255) NOT NULL,
    "houseNo" VARCHAR(50) NOT NULL,
    "zipCode" VARCHAR(20),
    "nationality" VARCHAR(50),
    "taxCountry" VARCHAR(50),
    "taxNumber" VARCHAR(100),
    "isTaxAddressCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxAddress_userId_key" ON "TaxAddress"("userId");

-- AddForeignKey
ALTER TABLE "TaxAddress" ADD CONSTRAINT "TaxAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
