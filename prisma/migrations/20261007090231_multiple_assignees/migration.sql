/*
  Warnings:

  - You are about to drop the column `assigneeId` on the `Ticket` table. Its data is copied into TicketAssignment first.

*/
-- CreateTable
CREATE TABLE "TicketAssignment" (
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ticketId", "userId"),
    CONSTRAINT "TicketAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Keep existing assignments: copy each ticket's single assignee into the new table.
INSERT INTO "TicketAssignment" ("ticketId", "userId") SELECT "id", "assigneeId" FROM "Ticket" WHERE "assigneeId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "departmentId" TEXT NOT NULL,
    "categoryId" TEXT,
    "locationId" TEXT,
    "requesterId" TEXT NOT NULL,
    "assetId" TEXT,
    "eventId" TEXT,
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("assetId", "categoryId", "createdAt", "departmentId", "description", "dueAt", "eventId", "id", "locationId", "number", "priority", "requesterId", "resolvedAt", "status", "title", "updatedAt") SELECT "assetId", "categoryId", "createdAt", "departmentId", "description", "dueAt", "eventId", "id", "locationId", "number", "priority", "requesterId", "resolvedAt", "status", "title", "updatedAt" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");
CREATE INDEX "Ticket_departmentId_status_idx" ON "Ticket"("departmentId", "status");
CREATE INDEX "Ticket_requesterId_idx" ON "Ticket"("requesterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TicketAssignment_userId_idx" ON "TicketAssignment"("userId");
