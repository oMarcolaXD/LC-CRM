import { redirect }            from "next/navigation"
import { auth }               from "@/lib/auth"
import { AppLayout }          from "@/components/shared/app-layout"
import { getActiveStudent }   from "@/lib/get-active-student"

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (!["GUARDIAN", "ADMIN"].includes(session.user.role)) redirect("/login")

  const { student, allStudents } = await getActiveStudent(session.user.id)

  const studentOptions = allStudents.map((s: { id: string; name: string; user: { name: string } | null; grade: string }) => ({
    id:    s.id,
    name:  s.name,
    grade: s.grade,
  }))

  return (
    <AppLayout
      name={session.user.name  ?? ""}
      email={session.user.email ?? ""}
      role={session.user.role}
      image={session.user.image}
      phone={session.user.phone}
      missingEmail={!session.user.email}
      allStudents={studentOptions}
      activeStudentId={student?.id}
    >
      {children}
    </AppLayout>
  )
}
