-- CreateTable
CREATE TABLE "AssetList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    CONSTRAINT "AssetList_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetList_departmentId_type_key" ON "AssetList"("departmentId", "type");
