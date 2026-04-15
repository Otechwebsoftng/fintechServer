-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "parentTransactionId" TEXT;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
