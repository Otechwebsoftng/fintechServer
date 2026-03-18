/*
  Warnings:

  - The values [NATIONAL_ID] on the enum `IdentityType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "IdentityType_new" AS ENUM ('NIN', 'PASSPORT', 'DRIVER_LICENSE');
ALTER TABLE "User" ALTER COLUMN "tier1idType" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "tier1idType" TYPE "IdentityType_new" USING ("tier1idType"::text::"IdentityType_new");
ALTER TABLE "User" ALTER COLUMN "identityType" TYPE "IdentityType_new" USING ("identityType"::text::"IdentityType_new");
ALTER TYPE "IdentityType" RENAME TO "IdentityType_old";
ALTER TYPE "IdentityType_new" RENAME TO "IdentityType";
DROP TYPE "IdentityType_old";
ALTER TABLE "User" ALTER COLUMN "tier1idType" SET DEFAULT 'NIN';
COMMIT;
