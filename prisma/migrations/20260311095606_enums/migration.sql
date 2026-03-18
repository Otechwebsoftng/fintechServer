-- CreateEnum
CREATE TYPE "Country" AS ENUM ('NG', 'US');

-- CreateEnum
CREATE TYPE "employeeStatus" AS ENUM ('EMPLOYED', 'UNEMPLOYED', 'STUDENT', 'RETIRED', 'SELF_EMPLOYED');

-- AlterEnum
ALTER TYPE "KycLevel" ADD VALUE 'TIER 0';
