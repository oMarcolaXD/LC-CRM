import { notFound }   from "next/navigation"
import { prisma }     from "@/lib/prisma"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TeacherSubjectsForm } from "@/components/shared/teacher-subjects-form"
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
  {
    value: "PRESENCIAL",
    label: "Presencial",
    desc: "Trabalha na sede. Atende alunos presencialmente e pode usar as salas para aulas online.",
    icon: <MapPin className="w-5 h-5" />,
  },
  {
    value: "ONLINE_ONLY",
    label: "Só Online",
    desc: "Trabalha de casa. Todas as aulas são realizadas via Google Meet ou Zoom.",
    icon: <Wifi className="w-5 h-5" />,
  },
  {
    value: "HYBRID",
    label: "Presencial e Online",
    desc: "Flexível. Pode atender na sede ou remotamente, conforme a demanda dos alunos.",
    icon: <LayoutGrid className="w-5 h-5" />,
  },
]

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminProfessorPage({ params }: Props) {
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
        backHref="/admin/professores"
      />

      {/* Perfil */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {teacher.user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Modalidade de Trabalho</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione como este professor prefere atender os alunos.
          </p>
        </CardHeader>
        <CardContent>
          <form action={updateMode} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODES.map(({ value, label, desc, icon }) => (
                <label key={value} className="cursor-pointer block group">
                  <input
                    type="radio"
                    name="teachingMode"
                    value={value}
                    defaultChecked={teacher.teachingMode === value}
                    className="peer sr-only"
                  />
                  <div className="h-full p-4 rounded-xl border-2 border-border transition-all
                    peer-checked:border-primary peer-checked:bg-primary/5
                    group-hover:border-primary/40 group-hover:bg-muted/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground transition-colors
                        group-has-[input:checked]:bg-primary/10 group-has-[input:checked]:text-primary">
                        {icon}
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center transition-all
                        group-has-[input:checked]:border-primary group-has-[input:checked]:bg-primary">
                        <div className="w-2 h-2 rounded-full bg-white opacity-0 transition-opacity
                          group-has-[input:checked]:opacity-100" />
                      </div>
                    </div>
                    <p className="font-semibold text-sm mb-1
                      group-has-[input:checked]:text-primary">{label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
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
