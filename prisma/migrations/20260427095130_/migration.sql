/*
  Warnings:

  - You are about to drop the column `account_id` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_id` on the `Webhook` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Webhook" DROP COLUMN "account_id",
DROP COLUMN "deposit_id",
ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "depositId" TEXT;
