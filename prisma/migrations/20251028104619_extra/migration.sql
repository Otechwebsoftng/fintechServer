/*
  Warnings:

  - The values [LEVEL_3] on the enum `KycLevel` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `accountStatus` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "IdentityType" ADD VALUE 'VOTER_ID';

-- AlterEnum
BEGIN;
CREATE TYPE "KycLevel_new" AS ENUM ('LEVEL_0', 'LEVEL_1', 'LEVEL_2');
ALTER TABLE "User" ALTER COLUMN "kycLevel" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "kycLevel" TYPE "KycLevel_new" USING ("kycLevel"::text::"KycLevel_new");
ALTER TYPE "KycLevel" RENAME TO "KycLevel_old";
ALTER TYPE "KycLevel_new" RENAME TO "KycLevel";
DROP TYPE "KycLevel_old";
ALTER TABLE "User" ALTER COLUMN "kycLevel" SET DEFAULT 'LEVEL_0';
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accountStatus",
ADD COLUMN     "otherName" TEXT,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL;
