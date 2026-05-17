-- CreateEnum
CREATE TYPE "TeacherMode" AS ENUM ('ONLINE_ONLY', 'PRESENCIAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('EF2', 'EM', 'SUPERIOR', 'VESTIBULAR');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "teacherOnsite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "educationLevel" "EducationLevel";

-- AlterTable
ALTER TABLE "teacher_subjects" ADD COLUMN     "levels" "EducationLevel"[];

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "teachingMode" "TeacherMode" NOT NULL DEFAULT 'HYBRID';
