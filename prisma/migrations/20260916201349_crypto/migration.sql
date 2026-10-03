-- CreateTable
CREATE TABLE "cryptoAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currency" "Currency" NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cryptoAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cryptoAddress_address_key" ON "cryptoAddress"("address");

-- CreateIndex
CREATE INDEX "cryptoAddress_address_idx" ON "cryptoAddress"("address");

-- AddForeignKey
ALTER TABLE "cryptoAddress" ADD CONSTRAINT "cryptoAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
