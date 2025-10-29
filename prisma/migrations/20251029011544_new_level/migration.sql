/*
  Warnings:

  - The values [LEVEL_0,LEVEL_1,LEVEL_2] on the enum `KycLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "KycLevel_new" AS ENUM ('LEVEL 0', 'LEVEL 1', 'LEVEL 2', 'LEVEL 3');
ALTER TABLE "User" ALTER COLUMN "kycLevel" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "kycLevel" TYPE "KycLevel_new" USING ("kycLevel"::text::"KycLevel_new");
ALTER TYPE "KycLevel" RENAME TO "KycLevel_old";
ALTER TYPE "KycLevel_new" RENAME TO "KycLevel";
DROP TYPE "KycLevel_old";
ALTER TABLE "User" ALTER COLUMN "kycLevel" SET DEFAULT 'LEVEL 0';
COMMIT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "kycLevel" SET DEFAULT 'LEVEL 0';
