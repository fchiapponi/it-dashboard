-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "emailThreadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_emailThreadId_key" ON "Ticket"("emailThreadId");

