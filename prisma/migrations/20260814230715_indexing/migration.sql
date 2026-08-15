-- DropIndex
DROP INDEX "User_email_phoneNumber_idx";

-- CreateIndex
CREATE INDEX "User_email_phoneNumber_userTag_idx" ON "User"("email", "phoneNumber", "userTag");
