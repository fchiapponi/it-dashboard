-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "ipAddress" TEXT NOT NULL,
    "snmpCommunity" TEXT NOT NULL DEFAULT 'public',
    "snmpVersion" INTEGER NOT NULL DEFAULT 2,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastPolledAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PrinterSupply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "levelPercent" INTEGER,
    "currentLevel" INTEGER,
    "maxCapacity" INTEGER,
    "unit" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrinterSupply_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrinterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printerId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "suppliesSnapshot" TEXT NOT NULL,
    CONSTRAINT "PrinterReading_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'onvif',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 80,
    "rtspPath" TEXT,
    "snapshotUrl" TEXT,
    "username" TEXT,
    "password" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastSeenAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "connectedEmail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiryDate" DATETIME,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PrinterSupply_printerId_name_key" ON "PrinterSupply"("printerId", "name");

-- CreateIndex
CREATE INDEX "PrinterReading_printerId_timestamp_idx" ON "PrinterReading"("printerId", "timestamp");
