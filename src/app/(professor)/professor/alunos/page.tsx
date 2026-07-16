import { auth }          from "@/lib/auth"
import { prisma }        from "@/lib/prisma"
import { redirect }      from "next/navigation"
import { PageHeader }    from "@/components/shared/page-header"
import { AlunosTable }   from "./alunos-table"
import type { AlunoProf } from "./alunos-table"
import {
  format, differenceInHours, differenceInDays, subMonths, startOfMonth,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { formatBR, nowBrazil } from "@/lib/datetime"

function relDate(date: Date, now: Date): string {
  const h = differenceInHours(now, date)
  const d = differenceInDays(now, date)
  if (h < 2)   return `hoje ${formatBR(date, "HH")}h`
  if (h < 24)  return `há ${h}h`
  if (d === 1) return "ontem"
  if (d < 7)   return `há ${d} dias`
  return format(date, "dd MMM", { locale: ptBR })
}

async function getMeusAlunos(email: string): Promise<AlunoProf[] | null> {
  const now = nowBrazil()
  const sixMonthsAgo = startOfMonth(subMonths(now, 5))

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email } },
    select: { id: true },
  })
  if (!teacher) return null

  const lessons = await prisma.lesson.findMany({
    where: {
      teacherId:   teacher.id,
      scheduledAt: { gte: sixMonthsAgo },
    },
    include: {
      participants: {
        include: {
          student: {
            include: {
              user:     true,
              packages: {
                where:   { status: { in: ["ACTIVE", "EXHAUSTED"] } },
                orderBy: { purchaseDate: "desc" },
                take:    1,
              },
            },
          },
        },
      },
      subject:  true,
      homework: { select: { id: true, status: true } },
    },
    orderBy: { scheduledAt: "desc" },
  })

  type Row = {
    id:              string
    name:            string
    grade:           string
    totalAulas:      number
    aulasCompletas:  number
    lastDate:        Date
    lastContent:     string
    modo:            "sede" | "online"
    remainingLessons: number | null
    packageStatus:   AlunoProf["packageStatus"]
    pendingHomework: number
    lastLessonId:    string | null
  }

  const map = new Map<string, Row>()

  for (const lesson of lessons) {
    for (const part of lesson.participants) {
      const st  = part.student
      const sid = st.id

      if (!map.has(sid)) {
        const pkg = st.packages[0]
        let packageStatus: AlunoProf["packageStatus"] = "sem-pacote"
        if (pkg) {
          if (pkg.status === "EXHAUSTED")    packageStatus = "esgotado"
          else if (Number(pkg.remainingLessons) <= 2) packageStatus = "renovar"
          else                               packageStatus = "ok"
        }

        map.set(sid, {
          id:              sid,
          name:            st.name,
          grade:           st.grade ?? "—",
          totalAulas:      0,
          aulasCompletas:  0,
          lastDate:        lesson.scheduledAt,
          lastContent:     lesson.topicsCovered ?? lesson.subject?.name ?? "–",
          modo:            lesson.modality === "PRESENCIAL" ? "sede" : "online",
          remainingLessons: pkg ? Number(pkg.remainingLessons) : null,
          packageStatus,
          pendingHomework: 0,
          lastLessonId:    null,
        })
      }

      const row = map.get(sid)!

      if (["SCHEDULED", "CONFIRMED", "COMPLETED"].includes(lesson.status)) {
        row.totalAulas++
      }
      if (lesson.status === "COMPLETED") {
        row.aulasCompletas++
      }

      // Track most recent lesson
      if (lesson.scheduledAt >= row.lastDate) {
        row.lastDate    = lesson.scheduledAt
        row.lastContent = lesson.topicsCovered ?? lesson.subject?.name ?? "–"
        row.modo        = lesson.modality === "PRESENCIAL" ? "sede" : "online"
        row.lastLessonId = lesson.id
      }

      // Count pending homework from this lesson
      for (const hw of lesson.homework) {
        if (hw.status !== "COMPLETED") row.pendingHomework++
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime())
    .map(row => ({
      id:              row.id,
      name:            row.name,
      initials:        row.name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase(),
      grade:           row.grade,
      totalAulas:      row.totalAulas,
      aulasCompletas:  row.aulasCompletas,
      lastAulaLabel:   relDate(row.lastDate, now),
      lastContent:     row.lastContent,
      modo:            row.modo,
      remainingLessons: row.remainingLessons,
      packageStatus:   row.packageStatus,
      pendingHomework: row.pendingHomework,
      lastLessonId:    row.lastLessonId,
    }))
}

export default async function ProfessorAlunosPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const alunos = await getMeusAlunos(session.user.email)

  if (!alunos) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Perfil de professor não encontrado. Contate o administrador.
      </div>
    )
  }

  const totalAlunos    = alunos.length
  const aRenovar       = alunos.filter(a => a.packageStatus === "renovar" || a.packageStatus === "esgotado").length
  const comLicaoPend   = alunos.filter(a => a.pendingHomework > 0).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="MEUS ALUNOS"
        description={`${totalAlunos} aluno${totalAlunos !== 1 ? "s" : ""} nos últimos 6 meses`}
      />

      {/* Stats row */}
      <div
        className="flex overflow-hidden rounded-[8px] border border-border"
        style={{ gap: "1px", background: "var(--border)" }}
      >
        {[
          { label: "Total de alunos",    value: totalAlunos,  sub: "últimos 6 meses"            },
          { label: "Precisam renovar",   value: aRenovar,     sub: "pacote baixo ou esgotado",
            valueColor: aRenovar > 0 ? "var(--warn)" : undefined },
          { label: "Lições pendentes",   value: comLicaoPend, sub: "com lição não entregue",
            valueColor: comLicaoPend > 0 ? "var(--danger)" : undefined },
        ].map(({ label, value, sub, valueColor }) => (
          <div key={label} className="min-w-[160px] flex-1 bg-card px-[18px] py-[12px]">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              {label}
            </p>
            <p
              className="mt-[2px] text-[22px] font-semibold leading-none tracking-[-0.02em]"
              style={{ color: valueColor ?? "var(--text)", fontFeatureSettings: '"tnum"' }}
            >
              {value}
            </p>
            <p className="mt-[2px] text-[10.5px]" style={{ color: "var(--subtle)" }}>
              {sub}
            </p>
          </div>
        ))}
      </div>

      <AlunosTable alunos={alunos} />
    </div>
  )
}
