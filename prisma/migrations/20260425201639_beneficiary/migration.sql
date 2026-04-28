/*
  Warnings:

  - You are about to drop the column `country` on the `Beneficiary` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `Beneficiary` table. All the data in the column will be lost.
  - Added the required column `currency` to the `Beneficiary` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Beneficiary" DROP CONSTRAINT "Beneficiary_userId_fkey";

-- DropIndex
DROP INDEX "Beneficiary_userId_accountNumber_idx";

-- AlterTable
ALTER TABLE "Beneficiary" DROP COLUMN "country",
DROP COLUMN "isDeleted",
ADD COLUMN     "currency" "Currency" NOT NULL,
ALTER COLUMN "accountNumber" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
