-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "blockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Connection_requesterId_status_idx" ON "Connection"("requesterId", "status");

-- CreateIndex
CREATE INDEX "Connection_receiverId_status_idx" ON "Connection"("receiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_requesterId_receiverId_key" ON "Connection"("requesterId", "receiverId");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "StudentProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
