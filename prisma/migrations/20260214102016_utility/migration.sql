-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('ELECTRICITY', 'WATER', 'GAS', 'CABLE_TV');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "UtilityBillNumber" VARCHAR(100),
ADD COLUMN     "utilityBillPublicId" TEXT,
ADD COLUMN     "utilityBillUrl" TEXT,
ADD COLUMN     "utilityProviderName" VARCHAR(100);
