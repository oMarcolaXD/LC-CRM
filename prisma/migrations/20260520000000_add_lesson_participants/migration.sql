-- CreateTable
CREATE TABLE "lesson_participants" (
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "lesson_participants_pkey" PRIMARY KEY ("lessonId","studentId")
);

-- CreateIndex
CREATE INDEX "lesson_participants_studentId_idx" ON "lesson_participants"("studentId");

-- AddForeignKey
ALTER TABLE "lesson_participants" ADD CONSTRAINT "lesson_participants_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_participants" ADD CONSTRAINT "lesson_participants_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_studentId_fkey";

-- DropIndex
DROP INDEX "lessons_studentId_idx";

-- AlterTable
ALTER TABLE "lessons"
DROP COLUMN "studentId",
DROP COLUMN "isGroupLesson",
DROP COLUMN "groupId",
DROP COLUMN "groupSize";
