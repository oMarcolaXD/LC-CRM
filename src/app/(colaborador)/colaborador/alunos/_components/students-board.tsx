"use client"

import { useState, useMemo }           from "react"
import Link                            from "next/link"
import { format }                      from "date-fns"
import { ptBR }                        from "date-fns/locale"
import {
  GraduationCap, Plus, Upload, LayoutGrid, List,
  Search, MessageCircle, CalendarDays, UserRound,
} from "lucide-react"
import { buttonVariants }              from "@/components/ui/button"
import { Input }                       from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                                      from "@/components/ui/select"
import { StudentBoardCard }            from "./student-board-card"
import type { StudentRow, BoardColumn } from "./student-board-card"

// ── Column definitions ────────────────────────────────────────────────────────

interface ColumnDef {
  id:          BoardColumn
  title:       string
  description: string
  topBorder:   string
  headerBg:    string
}

const COLUMNS: ColumnDef[] = [
  {
    id:          "atencao",
    title:       "Atenção imediata",
    description: "0–1 aula ou vencido",
    topBorder:   "border-t-red-400",
    headerBg:    "bg-red-50 dark:bg-red-950/20",
  },
  {
    id:          "renovar",
    title:       "Renovar em breve",
    description: "2–4 aulas restantes",
    topBorder:   "border-t-yellow-400",
    headerBg:    "bg-yellow-50 dark:bg-yellow-950/20",
  },
  {
    id:          "em-dia",
    title:       "Em dia",
    description: "sem alertas",
    topBorder:   "border-t-green-400",
    headerBg:    "bg-green-50 dark:bg-green-950/20",
  },
  {
    id:          "novos",
    title:       "Recém-cadastrados",
    description: "sem pacote ativo",
    topBorder:   "border-t-blue-400",
    headerBg:    "bg-blue-50 dark:bg-blue-950/20",
  },
]

// ── Classification ────────────────────────────────────────────────────────────

function classify(student: StudentRow): BoardColumn {
  const pkg = student.packages[0] ?? null
  if (!pkg) return "novos"

  const remaining = pkg.remainingLessons
  const isExpired = pkg.expiresAt && pkg.expiresAt < new Date()

  if (remaining <= 1 || isExpired || pkg.status === "EXHAUSTED") return "atencao"
  if (remaining <= 4) return "renovar"
  return "em-dia"
}

// ── List-view row ─────────────────────────────────────────────────────────────

function ListRow({ student, detailBasePath }: { student: StudentRow; detailBasePath: string }) {
  const pkg          = student.packages[0] ?? null
  const remaining    = pkg?.remainingLessons ?? 0
  const nextLesson   = student.participations[0]?.lesson ?? null
  const guardianUser = student.guardian?.user ?? null
  const guardianPhone = guardianUser?.phone?.replace(/\D/g, "") ?? null
  const studentPhone  = student.user?.phone?.replace(/\D/g, "") ?? null
  const waPhone       = guardianPhone ?? studentPhone
  const detailHref    = `${detailBasePath}/${student.id}`

  const badgeCls = remaining === 0 || pkg?.status === "EXHAUSTED"
    ? "bg-red-100 text-red-700"
    : remaining <= 1 ? "bg-orange-100 text-orange-700"
    : remaining <= 4 ? "bg-yellow-100 text-yellow-700"
    : "bg-green-100 text-green-700"

  const badgeLabel = !pkg ? "Sem pacote"
    : remaining === 0 || pkg.status === "EXHAUSTED" ? "Pacote esgotou"
    : remaining === 1 ? "Última aula"
    : `${remaining} aulas`

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors">
      <Link href={detailHref} className="absolute inset-0 rounded-xl z-0" aria-label={`Ver perfil de ${student.name}`} />

      <div className="flex gap-3 flex-1 min-w-0 relative z-10">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm">{student.name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>{badgeLabel}</span>
          </div>
          {guardianUser && (
            <div className="flex items-center gap-1.5">
              <UserRound className="w-3 h-3 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Resp.: <span className="font-medium text-foreground">{guardianUser.name}</span>
                {guardianUser.phone && <span> · {guardianUser.phone}</span>}
              </p>
            </div>
          )}
          {pkg && (
            <p className="text-xs text-muted-foreground">
              Pacote: {pkg.totalLessons} aulas
              {pkg.expiresAt && ` · vence ${format(pkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}`}
            </p>
          )}
          {nextLesson && (
            <div className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Próx: {format(nextLesson.scheduledAt, "dd/MM HH:mm", { locale: ptBR })} · {nextLesson.subject.name}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {waPhone && (
          <a
            href={`https://wa.me/55${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" }) + " text-[#219EBC] border-[#219EBC]/30 hover:bg-[#219EBC]/10 h-8 text-xs px-2"}
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            {guardianPhone ? "Resp." : "Aluno"}
          </a>
        )}
        <Link href={detailHref} className={buttonVariants({ variant: "outline", size: "sm" }) + " h-8 text-xs"}>
          Detalhes
        </Link>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface StudentsBoardProps {
  students:       StudentRow[]
  grades:         string[]
  subjects:       string[]
  newStudentHref: string
  importHref:     string
  detailBasePath: string
}

export function StudentsBoard({
  students,
  grades,
  subjects,
  newStudentHref,
  importHref,
  detailBasePath,
}: StudentsBoardProps) {
  const [search,        setSearch]        = useState("")
  const [gradeFilter,   setGradeFilter]   = useState("todos")
  const [subjectFilter, setSubjectFilter] = useState("todos")
  const [visao,         setVisao]         = useState<"quadro" | "lista">("quadro")

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return students.filter(s => {
      if (gradeFilter !== "todos" && s.grade !== gradeFilter) return false
      if (subjectFilter !== "todos") {
        const subj = s.participations[0]?.lesson.subject.name
        if (subj !== subjectFilter) return false
      }
      if (q) {
        const matchName     = s.name.toLowerCase().includes(q)
        const matchGuardian = s.guardian?.user.name?.toLowerCase().includes(q) ?? false
        const matchPhone    = (s.user?.phone ?? "").includes(q)
                           || (s.guardian?.user.phone ?? "").includes(q)
        if (!matchName && !matchGuardian && !matchPhone) return false
      }
      return true
    })
  }, [students, gradeFilter, subjectFilter, search])

  const byColumn = useMemo(() => {
    const map: Record<BoardColumn, StudentRow[]> = {
      atencao: [], renovar: [], "em-dia": [], novos: [],
    }
    for (const s of filtered) map[classify(s)].push(s)
    return map
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Aluno, responsável, telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "todos")}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Série" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as séries</SelectItem>
            {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Matéria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as matérias</SelectItem>
            {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex items-center border rounded-lg overflow-hidden h-9 shrink-0">
          <button
            onClick={() => setVisao("quadro")}
            className={`px-3 h-full flex items-center gap-1.5 text-xs font-medium transition-colors ${visao === "quadro" ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Quadro
          </button>
          <button
            onClick={() => setVisao("lista")}
            className={`px-3 h-full flex items-center gap-1.5 text-xs font-medium transition-colors border-l ${visao === "lista" ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"}`}
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
        </div>

        <Link href={importHref} className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-2 h-9 shrink-0"}>
          <Upload className="w-4 h-4" />
          Importar
        </Link>
        <Link href={newStudentHref} className={buttonVariants({ variant: "default", size: "sm" }) + " gap-2 h-9 shrink-0"}>
          <Plus className="w-4 h-4" />
          Novo aluno
        </Link>
      </div>

      {/* Board view */}
      {visao === "quadro" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => {
            const colStudents = byColumn[col.id]
            return (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`rounded-xl border-t-4 ${col.topBorder} ${col.headerBg} border border-border/50 px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{col.title}</h3>
                      <p className="text-xs text-muted-foreground">{col.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{colStudents.length}</span>
                      <Link
                        href={newStudentHref}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
                        title="Novo aluno"
                      >
                        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {colStudents.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-card/50 flex items-center justify-center py-10">
                      <p className="text-sm text-muted-foreground">Nada por aqui</p>
                    </div>
                  ) : (
                    colStudents.map(s => (
                      <StudentBoardCard
                        key={s.id}
                        student={s}
                        column={col.id}
                        detailBasePath={detailBasePath}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {visao === "lista" && (
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <GraduationCap className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
              <Link href={newStudentHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Plus className="w-4 h-4 mr-1" /> Cadastrar aluno
              </Link>
            </div>
          ) : (
            filtered.map(s => (
              <ListRow key={s.id} student={s} detailBasePath={detailBasePath} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
