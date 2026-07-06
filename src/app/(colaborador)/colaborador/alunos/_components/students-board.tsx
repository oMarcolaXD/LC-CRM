"use client"

import { useState, useMemo }           from "react"
import Link                            from "next/link"
import { format }                      from "date-fns"
import { ptBR }                        from "date-fns/locale"
import {
  GraduationCap, Plus, Upload, LayoutGrid, List,
  Search, MessageCircle, CalendarDays, UserRound,
  ArrowDownWideNarrow, School as SchoolIcon, Mail, Phone,
} from "lucide-react"
import { buttonVariants }              from "@/components/ui/button"
import { Input }                       from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
}                                      from "@/components/ui/select"
import { StudentBoardCard }            from "./student-board-card"
import type { StudentRow, BoardColumn } from "./student-board-card"

// Normaliza texto para busca: remove acentos e caixa (ex.: "José" → "jose")
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

type SortOption = "nome" | "mais-aulas" | "recentes" | "maior-pacote"

const SORT_LABELS: Record<SortOption, string> = {
  "nome":         "Nome (A–Z)",
  "mais-aulas":   "Mais aulas",
  "recentes":     "Aulas mais recentes",
  "maior-pacote": "Maior pacote ativo",
}

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
    id:          "novos",
    title:       "Recém-cadastrados",
    description: "sem pacote ativo",
    topBorder:   "border-t-blue-400",
    headerBg:    "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    id:          "em-dia",
    title:       "Em dia",
    description: "sem alertas",
    topBorder:   "border-t-green-400",
    headerBg:    "bg-green-50 dark:bg-green-950/20",
  },
  {
    id:          "renovar",
    title:       "Renovar em breve",
    description: "2–4 aulas restantes",
    topBorder:   "border-t-yellow-400",
    headerBg:    "bg-yellow-50 dark:bg-yellow-950/20",
  },
  {
    id:          "atencao",
    title:       "Atenção imediata",
    description: "0–1 aula ou vencido",
    topBorder:   "border-t-red-400",
    headerBg:    "bg-red-50 dark:bg-red-950/20",
  },
]

// ── Classification ────────────────────────────────────────────────────────────

function classify(student: StudentRow): BoardColumn {
  const pkg = student.packages[0] ?? null
  if (!pkg) return "novos"

  const remaining = Number(pkg.remainingLessons)
  const expiresAt = pkg.expiresAt ? new Date(pkg.expiresAt) : null
  const isExpired = expiresAt && expiresAt < new Date()

  if (remaining <= 1 || isExpired || pkg.status === "EXHAUSTED") return "atencao"
  if (remaining <= 4) return "renovar"
  return "em-dia"
}

// ── List-view row ─────────────────────────────────────────────────────────────

function ListRow({ student, detailBasePath }: { student: StudentRow; detailBasePath: string }) {
  const displayName  = student.name?.trim() || student.user?.name?.trim() || "Aluno"
  const pkg          = student.packages[0] ?? null
  const remaining    = Number(pkg?.remainingLessons ?? 0)
  const nextLesson   = student.participations[0]?.lesson ?? null
  const guardianUser = student.guardian?.user ?? null
  const guardianPhone = guardianUser?.phone?.replace(/\D/g, "") ?? null
  const studentPhone  = student.user?.phone?.replace(/\D/g, "") ?? null
  const studentPhoneRaw = student.user?.phone ?? null
  const studentEmail  = student.user?.email ?? null
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
      <Link href={detailHref} className="absolute inset-0 rounded-xl z-0" aria-label={`Ver perfil de ${displayName}`} />

      <div className="flex gap-3 flex-1 min-w-0 relative z-10">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm">{displayName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>{badgeLabel}</span>
          </div>

          {/* Identidade (série · escola) */}
          {(student.grade || student.school) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {student.grade && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3 h-3 shrink-0" />
                  {student.grade}
                </span>
              )}
              {student.school && (
                <span className="flex items-center gap-1.5">
                  <SchoolIcon className="w-3 h-3 shrink-0" />
                  {student.school}
                </span>
              )}
            </div>
          )}

          {/* Contatos rápidos (aluno e responsável) */}
          {(studentEmail || studentPhoneRaw || guardianUser) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {studentPhoneRaw && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  {studentPhoneRaw}
                </span>
              )}
              {studentEmail && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{studentEmail}</span>
                </span>
              )}
              {guardianUser && (
                <span className="flex items-center gap-1.5">
                  <UserRound className="w-3 h-3 shrink-0" />
                  Resp.: <span className="font-medium text-foreground">{guardianUser.name}</span>
                  {guardianUser.phone && <span>· {guardianUser.phone}</span>}
                </span>
              )}
            </div>
          )}

          {nextLesson && (
            <div className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Próx: {format(new Date(nextLesson.scheduledAt), "dd/MM HH:mm", { locale: ptBR })} · {nextLesson.subject?.name ?? "–"}
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
            className={buttonVariants({ variant: "outline", size: "sm" }) + " text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 h-8 text-xs px-2"}
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
  newStudentHref: string
  importHref:     string
  detailBasePath: string
  activeTab?:     "ativos" | "inativos" | "todos"
  totalAtivos?:   number
  totalInativos?: number
}

export function StudentsBoard({
  students,
  grades,
  newStudentHref,
  importHref,
  detailBasePath,
  activeTab = "ativos",
  totalAtivos = 0,
  totalInativos = 0,
}: StudentsBoardProps) {
  const [search,      setSearch]      = useState("")
  const [gradeFilter, setGradeFilter] = useState("todos")
  const [sortBy,      setSortBy]      = useState<SortOption>("nome")
  const [visao,       setVisao]       = useState<"quadro" | "lista">("quadro")

  const filtered = useMemo(() => {
    const q = norm(search.trim())
    return students.filter(s => {
      if (gradeFilter !== "todos" && s.grade !== gradeFilter) return false
      if (q) {
        const matchName     = norm(s.name?.trim() || s.user?.name || "").includes(q)
        const matchGuardian = s.guardian?.user.name ? norm(s.guardian.user.name).includes(q) : false
        const matchPhone    = (s.user?.phone ?? "").includes(q)
                           || (s.guardian?.user.phone ?? "").includes(q)
        if (!matchName && !matchGuardian && !matchPhone) return false
      }
      return true
    })
  }, [students, gradeFilter, search])

  const sorted = useMemo(() => {
    const nameOf   = (s: StudentRow) => (s.name?.trim() || s.user?.name || "").toLowerCase()
    const totalOf  = (s: StudentRow) => s._count.participations
    const remainOf = (s: StudentRow) => Number(s.packages[0]?.remainingLessons ?? 0)
    const lastOf   = (s: StudentRow) => (s.lastLessonAt ? new Date(s.lastLessonAt).getTime() : 0)
    const byName   = (a: StudentRow, b: StudentRow) => nameOf(a).localeCompare(nameOf(b))

    const arr = [...filtered]
    switch (sortBy) {
      case "mais-aulas":   arr.sort((a, b) => totalOf(b)  - totalOf(a)  || byName(a, b)); break
      case "recentes":     arr.sort((a, b) => lastOf(b)   - lastOf(a)   || byName(a, b)); break
      case "maior-pacote": arr.sort((a, b) => remainOf(b) - remainOf(a) || byName(a, b)); break
      default:             arr.sort(byName)
    }
    return arr
  }, [filtered, sortBy])

  const byColumn = useMemo(() => {
    const map: Record<BoardColumn, StudentRow[]> = {
      atencao: [], renovar: [], "em-dia": [], novos: [],
    }
    for (const s of sorted) map[classify(s)].push(s)
    return map
  }, [sorted])

  return (
    <div className="space-y-4">
      {/* Status tabs (server-driven via href) */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {([
          { key: "ativos",   label: "Ativos",    count: totalAtivos },
          { key: "inativos", label: "Ex-alunos", count: totalInativos },
          { key: "todos",    label: "Todos",      count: totalAtivos + totalInativos },
        ] as const).map(tab => (
          <a
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {tab.count}
            </span>
          </a>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-45">
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
            <SelectValue>
              {(v: unknown) => (!v || v === "todos" ? "Todas as séries" : String(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as séries</SelectItem>
            {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy((v as SortOption) ?? "nome")}>
          <SelectTrigger className="w-48 h-9">
            <ArrowDownWideNarrow className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <SelectValue>
              {(v: unknown) => (v ? SORT_LABELS[v as SortOption] : "Ordenar por")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(k => (
              <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
            ))}
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
            sorted.map(s => (
              <ListRow key={s.id} student={s} detailBasePath={detailBasePath} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
