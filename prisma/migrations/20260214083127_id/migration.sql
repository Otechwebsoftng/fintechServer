-- AlterTable
ALTER TABLE "User" ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "issuedDate" TIMESTAMP(3),
ADD COLUMN     "issusedCountry" VARCHAR(50);
