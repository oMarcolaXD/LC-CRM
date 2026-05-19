import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { redirect }         from "next/navigation"
import { getActiveStudent } from "@/lib/get-active-student"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge }             from "@/components/ui/badge"
import { buttonVariants }    from "@/components/ui/button"
import { cn }                from "@/lib/utils"
import { FolderOpen, ExternalLink, User, BookOpen } from "lucide-react"
import { format } from "date-fns"
import { ptBR }   from "date-fns/locale"

const TYPE_COLORS: Record<string, string> = {
  PDF:          "bg-red-50 text-red-600",
  Vídeo:        "bg-purple-50 text-purple-600",
  Link:         "bg-blue-50 text-blue-600",
  Apresentação: "bg-orange-50 text-orange-600",
  Documento:    "bg-gray-100 text-gray-600",
  Áudio:        "bg-green-50 text-green-600",
}

export default async function AlunoMateriaisPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { student } = await getActiveStudent(session.user.id)
  if (!student) redirect("/aluno/sem-aluno")

  const teacherRows = await prisma.lesson.findMany({
    where:    { studentId: student.id },
    select:   { teacherId: true },
    distinct: ["teacherId"],
  })
  const teacherIds = teacherRows.map((r) => r.teacherId)

  const materials = await prisma.material.findMany({
        where: {
          OR: [
            { studentId: student.id },
            { teacherId: { in: teacherIds }, studentId: null },
          ],
        },
        include: {
          teacher: { include: { user: true } },
          subject: true,
        },
        orderBy: { uploadedAt: "desc" },
      })

  return (
    <div className="space-y-6">
      <PageHeader title="MATERIAIS" />

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum material disponível ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m, i) => (
            <Card key={m.id} className="card-lift animate-fade-up"
              style={{ "--delay": `${i * 40}ms` } as React.CSSProperties}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-secondary/10 p-2 rounded-lg shrink-0">
                    <FolderOpen className="w-4 h-4 text-secondary" />
                  </div>
                  <Badge className={`text-xs shrink-0 ${TYPE_COLORS[m.fileType] ?? "bg-gray-100 text-gray-600"}`}>
                    {m.fileType}
                  </Badge>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug line-clamp-2">{m.title}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {m.subject && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="w-3 h-3" /> {m.subject.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" /> {m.teacher.user.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(m.uploadedAt, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>

                <a
                  href={m.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center")}
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" /> Abrir
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
