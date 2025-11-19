-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "updaterId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_updaterId_fkey" FOREIGN KEY ("updaterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
