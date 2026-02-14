-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBillRecent" BOOLEAN DEFAULT false,
ADD COLUMN     "utilityBillIssuedDate" TIMESTAMP(3);
