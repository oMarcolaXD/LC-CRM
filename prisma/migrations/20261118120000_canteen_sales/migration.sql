-- CreateEnum
CREATE TYPE "CanteenStatus" AS ENUM ('PAID', 'PENDING');

-- CreateTable
CREATE TABLE "canteen_sales" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "status" "CanteenStatus" NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canteen_sales_studentId_idx" ON "canteen_sales"("studentId");

-- CreateIndex
CREATE INDEX "canteen_sales_soldAt_idx" ON "canteen_sales"("soldAt");

-- CreateIndex
CREATE INDEX "canteen_sales_paidAt_idx" ON "canteen_sales"("paidAt");

-- CreateIndex
CREATE INDEX "canteen_sales_status_idx" ON "canteen_sales"("status");

-- AddForeignKey
ALTER TABLE "canteen_sales" ADD CONSTRAINT "canteen_sales_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

