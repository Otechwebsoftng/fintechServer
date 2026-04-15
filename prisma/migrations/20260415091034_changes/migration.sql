-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "autoSweep" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "beneficiaryAddress" JSONB,
ADD COLUMN     "iban" VARCHAR(34),
ADD COLUMN     "routingNumber" VARCHAR(20),
ADD COLUMN     "settlementConfig" JSONB,
ADD COLUMN     "swiftCode" VARCHAR(20),
ADD COLUMN     "whiteListEnabled" BOOLEAN NOT NULL DEFAULT false;
