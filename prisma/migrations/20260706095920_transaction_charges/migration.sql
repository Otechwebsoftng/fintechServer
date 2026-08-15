-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('deposit', 'payout', 'maintenance', 'account_issuance', 'compliance', 'chargeBack_fraud_wire_recall');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "transactionChargeId" TEXT;

-- CreateTable
CREATE TABLE "TransactionCharge" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(256),
    "chargeType" "ChargeType" NOT NULL DEFAULT 'deposit',
    "percentage" DOUBLE PRECISION DEFAULT 0,
    "fixedAmount" DOUBLE PRECISION DEFAULT 0,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionCharge_chargeType_currency_idx" ON "TransactionCharge"("chargeType", "currency");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transactionChargeId_fkey" FOREIGN KEY ("transactionChargeId") REFERENCES "TransactionCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
