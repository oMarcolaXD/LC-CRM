-- CreateTable
CREATE TABLE "lesson_cancellation_requests" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_cancellation_requests_lessonId_idx" ON "lesson_cancellation_requests"("lessonId");

-- CreateIndex
CREATE INDEX "lesson_cancellation_requests_requestedById_idx" ON "lesson_cancellation_requests"("requestedById");

-- CreateIndex
CREATE INDEX "lesson_cancellation_requests_status_idx" ON "lesson_cancellation_requests"("status");

-- AddForeignKey
ALTER TABLE "lesson_cancellation_requests" ADD CONSTRAINT "lesson_cancellation_requests_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_cancellation_requests" ADD CONSTRAINT "lesson_cancellation_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_cancellation_requests" ADD CONSTRAINT "lesson_cancellation_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
