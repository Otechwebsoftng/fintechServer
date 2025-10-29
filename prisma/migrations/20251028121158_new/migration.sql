/*
  Warnings:

  - The values [GHS] on the enum `Currency` will be removed. If these variants are still used in the database, this will fail.
  - The values [VOTER_ID] on the enum `IdentityType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Currency_new" AS ENUM ('USD', 'EUR', 'GBP', 'NGN', 'CAD');
ALTER TYPE "Currency" RENAME TO "Currency_old";
ALTER TYPE "Currency_new" RENAME TO "Currency";
DROP TYPE "Currency_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "IdentityType_new" AS ENUM ('NIN', 'PASSPORT', 'DRIVER_LICENSE', 'NATIONAL_ID');
ALTER TABLE "User" ALTER COLUMN "identityType" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "identityType" TYPE "IdentityType_new" USING ("identityType"::text::"IdentityType_new");
ALTER TYPE "IdentityType" RENAME TO "IdentityType_old";
ALTER TYPE "IdentityType_new" RENAME TO "IdentityType";
DROP TYPE "IdentityType_old";
ALTER TABLE "User" ALTER COLUMN "identityType" SET DEFAULT 'NIN';
COMMIT;
