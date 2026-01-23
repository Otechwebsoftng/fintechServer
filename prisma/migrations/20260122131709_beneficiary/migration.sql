-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountStatus" ADD VALUE 'FLAGGED';
ALTER TYPE "AccountStatus" ADD VALUE 'SUSPENDED';

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" VARCHAR(50) NOT NULL,
    "bankName" VARCHAR(100) NOT NULL,
    "accountNumber" INTEGER NOT NULL,
    "accountName" VARCHAR(100) NOT NULL,
    "bankCode" VARCHAR(10) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Beneficiary_userId_accountNumber_idx" ON "Beneficiary"("userId", "accountNumber");

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
