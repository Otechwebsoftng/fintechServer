/*
  Warnings:

  - The values [USD,NGN] on the enum `WalletType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WalletType_new" AS ENUM ('INDIVIDUAL', 'COOPERATE');
ALTER TYPE "WalletType" RENAME TO "WalletType_old";
ALTER TYPE "WalletType_new" RENAME TO "WalletType";
DROP TYPE "WalletType_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "streetNo" TEXT,
ADD COLUMN     "taxCountry" TEXT,
ADD COLUMN     "taxNumber" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "accountType" "WalletType" DEFAULT 'INDIVIDUAL';
