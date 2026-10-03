/*
  Warnings:

  - Changed the type of `currency` on the `CryptoAddress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CryptoCurrency" AS ENUM ('BTC', 'ETH', 'USDT');

-- AlterTable
ALTER TABLE "CryptoAddress" DROP COLUMN "currency",
ADD COLUMN     "currency" "CryptoCurrency" NOT NULL;
