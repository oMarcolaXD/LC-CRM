"use server"

import { auth }           from "@/lib/auth"
import { prisma }         from "@/lib/prisma"
import { cookies }        from "next/headers"
import { revalidatePath } from "next/cache"

export async function selectStudentAction(studentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "no_session" }

    // ADMIN pode trocar qualquer aluno sem validação de posse
    if (session.user.role !== "ADMIN") {
      const guardian = await prisma.guardian.findFirst({
        where:   { userId: session.user.id },
        include: { students: { select: { id: true } } },
      })

      const owns = guardian?.students.some((s) => s.id === studentId)
      if (!owns) return { ok: false, error: "not_owned" }
    }

    const cookieStore = await cookies()
    cookieStore.set("selected_student_id", studentId, {
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 30,
    })

    revalidatePath("/aluno", "layout")
    return { ok: true }
  } catch (err) {
    console.error("[selectStudentAction] erro:", err)
    return { ok: false, error: "unexpected" }
  }
}
