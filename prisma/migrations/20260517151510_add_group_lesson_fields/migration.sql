-- AlterTable
ALTER TABLE "lesson_requests" ADD COLUMN     "groupNote" TEXT,
ADD COLUMN     "isGroupRequest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "groupSize" INTEGER,
ADD COLUMN     "priceOverride" DECIMAL(10,2);
