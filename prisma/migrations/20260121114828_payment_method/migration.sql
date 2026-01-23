/*
  Warnings:

  - You are about to drop the column `payMethod` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `accountNumber` on the `Wallet` table. All the data in the column will be lost.
  - Added the required column `currency` to the `WalletTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Wallet_accountNumber_key";

-- DropIndex
DROP INDEX "WalletTransaction_reference_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "payMethod",
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD';

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "accountNumber";

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "currency" "Currency" NOT NULL,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "reference" DROP NOT NULL;
