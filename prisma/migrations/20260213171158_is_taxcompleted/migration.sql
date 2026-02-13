-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTaxAddressCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zipCode" TEXT;
