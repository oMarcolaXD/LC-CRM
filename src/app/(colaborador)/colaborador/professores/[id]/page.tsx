import { notFound }   from "next/navigation"
import { prisma }     from "@/lib/prisma"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TeacherSubjectsForm } from "@/app/(admin)/admin/usuarios/[id]/teacher-subjects-form"
import { updateTeacherModeAction } from "@/lib/actions/teacher"
import { Wifi, MapPin, LayoutGrid, UserCircle } from "lucide-react"
import type { EducationLevel } from "@prisma/client"

const MODE_LABEL = { ONLINE_ONLY: "Só Online", PRESENCIAL: "Presencial", HYBRID: "Presencial e Online" }
const MODE_DESC  = {
  ONLINE_ONLY: "Dá aulas apenas online, de casa.",
  PRESENCIAL:  "Vem à sede; dá aulas presenciais e pode dar online de uma sala.",
  HYBRID:      "Pode trabalhar de casa (online) e vir à sede (presencial/online).",
}
const MODES = [
  { value: "PRESENCIAL",  label: "Presencial",          icon: <MapPin className="w-4 h-4" />   },
  { value: "ONLINE_ONLY", label: "Só Online",           icon: <Wifi className="w-4 h-4" />     },
  { value: "HYBRID",      label: "Presencial e Online", icon: <LayoutGrid className="w-4 h-4" /> },
]

interface Props {
  params: Promise<{ id: string }>
}

export default async function ColabProfessorPage({ params }: Props) {
  const { id } = await params

  const teacher = await prisma.teacher.findUnique({
    where:   { id },
    include: { user: true, subjects: { include: { subject: true } } },
  })
  if (!teacher) notFound()

  const allSubjects = await prisma.subject.findMany({ orderBy: { name: "asc" } })

  const updateMode = updateTeacherModeAction.bind(null, id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={teacher.user.name.toUpperCase()}
        description="Configuração de matérias e modo de ensino"
        backHref="/colaborador/professores"
      />

      {/* Perfil */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {teacher.user.avatar ? (
                <img src={teacher.user.avatar} alt={teacher.user.name} className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-8 h-8 text-primary/60" />
              )}
            </div>
            <div>
              <p className="font-semibold text-lg">{teacher.user.name}</p>
              <p className="text-sm text-muted-foreground">{teacher.user.email}</p>
              {teacher.bio && <p className="text-sm mt-1">{teacher.bio}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Modalidade atual: <strong>{MODE_LABEL[teacher.teachingMode as keyof typeof MODE_LABEL]}</strong>
                {" — "}{MODE_DESC[teacher.teachingMode as keyof typeof MODE_DESC]}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modo de ensino */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modalidade de Trabalho</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateMode} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODES.map(({ value, label, icon }) => (
              <label key={value}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  teacher.teachingMode === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}>
                <input type="radio" name="teachingMode" value={value}
                  defaultChecked={teacher.teachingMode === value}
                  className="accent-primary" />
                <span className="flex items-center gap-2 text-sm font-medium">
                  {icon} {label}
                </span>
              </label>
            ))}
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit"
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                Salvar Modalidade
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Matérias e níveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matérias e Níveis de Ensino</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marque as matérias e os níveis que este professor está habilitado a lecionar.
          </p>
        </CardHeader>
        <CardContent>
          <TeacherSubjectsForm
            teacherId={teacher.id}
            allSubjects={allSubjects}
            currentSubjects={teacher.subjects.map((ts) => ({
              subjectId: ts.subjectId,
              levels:    ts.levels as EducationLevel[],
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
