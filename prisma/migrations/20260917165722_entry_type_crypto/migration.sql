/*
  Warnings:

  - You are about to drop the column `confirmedAt` on the `CryptoPayment` table. All the data in the column will be lost.
  - You are about to drop the column `detectedAt` on the `CryptoPayment` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `CryptoPayment` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `CryptoPayment` table. All the data in the column will be lost.
  - Added the required column `transactionType` to the `CryptoPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CryptoPayment" DROP COLUMN "confirmedAt",
DROP COLUMN "detectedAt",
DROP COLUMN "metadata",
DROP COLUMN "provider",
ADD COLUMN     "transactionType" "PaymentEntry" NOT NULL;
