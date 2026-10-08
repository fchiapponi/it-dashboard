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
CREATE UNIQUE INDEX "Camera_host_port_key" ON "Camera"("host", "port");

-- CreateIndex
CREATE UNIQUE INDEX "Server_ipAddress_key" ON "Server"("ipAddress");

