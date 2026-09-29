-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastSeenAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Server_ipAddress_key" ON "Server"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Camera_host_port_key" ON "Camera"("host", "port");

-- CreateIndex
CREATE UNIQUE INDEX "Printer_ipAddress_key" ON "Printer"("ipAddress");

