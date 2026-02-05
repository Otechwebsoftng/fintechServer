/*
  Warnings:

  - The values [SIGNUP,CHANGEPASSWORD,FORGOTPASSWORD] on the enum `OtpType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OtpType_new" AS ENUM ('SIGN_UP', 'CHANGE_PASSWORD', 'FORGOT_PASSWORD');
ALTER TABLE "User" ALTER COLUMN "otpType" TYPE "OtpType_new" USING ("otpType"::text::"OtpType_new");
ALTER TYPE "OtpType" RENAME TO "OtpType_old";
ALTER TYPE "OtpType_new" RENAME TO "OtpType";
DROP TYPE "OtpType_old";
COMMIT;
