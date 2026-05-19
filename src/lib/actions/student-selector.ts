"use server"

import { auth }        from "@/lib/auth"
import { prisma }      from "@/lib/prisma"
import { cookies }     from "next/headers"
import { redirect }    from "next/navigation"

export async function selectStudentAction(studentId: string, returnPath = "/aluno/dashboard") {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const guardian = await prisma.guardian.findFirst({
    where: { userId: session.user.id },
    include: { students: { select: { id: true } } },
  })

  const owns = guardian?.students.some((s) => s.id === studentId)
  if (!owns) redirect(returnPath)  // aluno não pertence — apenas redireciona

  const cookieStore = await cookies()
  cookieStore.set("selected_student_id", studentId, {
    path:     "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30,
  })

  redirect(returnPath)
}
