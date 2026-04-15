-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
