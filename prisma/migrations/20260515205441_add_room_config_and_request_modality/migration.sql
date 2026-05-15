-- AlterTable
ALTER TABLE "lesson_requests" ADD COLUMN     "modality" "LessonModality" NOT NULL DEFAULT 'PRESENCIAL';

-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);
