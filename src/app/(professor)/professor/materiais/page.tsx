import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }          from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn }             from "@/lib/utils"
import { MaterialForm }         from "./material-form"
import { DeleteMaterialButton } from "./delete-material-button"
import { FolderOpen, ExternalLink, BookOpen, User, Plus } from "lucide-react"
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

export default async function ProfessorMateriaisPage() {
  const session = await auth()

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session?.user?.email ?? "" } },
  })

  const [materials, students, subjectRows] = await Promise.all([
    teacher ? prisma.material.findMany({
      where:   { teacherId: teacher.id },
      include: { subject: true },
      orderBy: { uploadedAt: "desc" },
    }) : [],
    teacher ? prisma.student.findMany({
      where:   { participations: { some: { lesson: { teacherId: teacher.id } } } },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }) : [],
    teacher ? prisma.teacherSubject.findMany({
      where:   { teacherId: teacher.id },
      include: { subject: true },
    }) : [],
  ])

  const studentOptions = students.map((s) => ({ id: s.id, name: s.user?.name ?? "Aluno" }))
  const subjectOptions = subjectRows.map((ts) => ({ id: ts.subjectId, name: ts.subject.name }))

  // Para mostrar nome do aluno nos materiais com studentId
  const studentMap = Object.fromEntries(students.map((s) => [s.id, s.user?.name ?? "Aluno"]))

  return (
    <div className="space-y-6">
      <PageHeader title="MATERIAIS" />

      {/* Form de novo material */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo Material
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MaterialForm students={studentOptions} subjects={subjectOptions} />
        </CardContent>
      </Card>

      {/* Lista de materiais */}
      <section className="space-y-3">
        <h2 className="font-sub font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Meus Materiais ({materials.length})
        </h2>

        {materials.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum material cadastrado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          materials.map((m, i) => (
            <Card key={m.id} className="card-lift animate-fade-up"
              style={{ "--delay": `${i * 40}ms` } as React.CSSProperties}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-secondary/10 p-2 rounded-lg shrink-0">
                  <FolderOpen className="w-4 h-4 text-secondary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{m.title}</p>
                    <Badge className={`text-xs ${TYPE_COLORS[m.fileType] ?? "bg-gray-100 text-gray-600"}`}>
                      {m.fileType}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {m.subject && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="w-3 h-3" /> {m.subject.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {m.studentId ? studentMap[m.studentId] ?? "Aluno específico" : "Todos os alunos"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(m.uploadedAt, "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <DeleteMaterialButton materialId={m.id} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
