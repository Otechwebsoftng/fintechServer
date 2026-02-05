/*
  Warnings:

  - A unique constraint covering the columns `[request_id]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('SIGNUP', 'CHANGEPASSWORD', 'FORGOTPASSWORD');

-- DropIndex
DROP INDEX "Payment_userId_reference_idx";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "merchant_order_id" VARCHAR(64),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "request_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otpType" "OtpType";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_request_id_key" ON "Payment"("request_id");

-- CreateIndex
CREATE INDEX "Payment_userId_reference_request_id_idx" ON "Payment"("userId", "reference", "request_id");
