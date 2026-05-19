import { cookies } from "next/headers"
import { prisma }  from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type StudentWithUser = Prisma.StudentGetPayload<{ include: { user: true } }>

export async function getActiveStudent(guardianUserId: string) {
  const guardian = await prisma.guardian.findFirst({
    where:   { userId: guardianUserId },
    include: {
      students: {
        include: { user: true },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!guardian) return { student: null as StudentWithUser | null, guardian: null, allStudents: [] as StudentWithUser[] }

  const cookieStore = await cookies()
  const cookieStudentId = cookieStore.get("selected_student_id")?.value

  const student =
    guardian.students.find((s) => s.id === cookieStudentId) ??
    guardian.students[0] ??
    null

  return { student, guardian, allStudents: guardian.students }
}
