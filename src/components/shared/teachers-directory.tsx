"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Wifi, MapPin, LayoutGrid, ChevronRight, UserCircle, Search, X, Filter,
} from "lucide-react"

const MODE_LABEL = { ONLINE_ONLY: "Só Online", PRESENCIAL: "Presencial", HYBRID: "Presencial e Online" } as const
const MODE_COLOR = {
  ONLINE_ONLY: "bg-blue-100 text-blue-700",
  PRESENCIAL:  "bg-green-100 text-green-700",
  HYBRID:      "bg-orange-100 text-orange-700",
} as const
const MODE_ICON = {
  ONLINE_ONLY: <Wifi className="w-3 h-3" />,
  PRESENCIAL:  <MapPin className="w-3 h-3" />,
  HYBRID:      <LayoutGrid className="w-3 h-3" />,
} as const

const LEVEL_LABEL: Record<string, string> = {
  EF2: "Fund. 2", EM: "Ens. Médio", SUPERIOR: "Superior", VESTIBULAR: "Vestibular",
}
const LEVEL_ORDER = ["EF2", "EM", "SUPERIOR", "VESTIBULAR"] as const

export interface TeacherDirItem {
  id:           string
  name:         string
  email:        string | null
  avatar:       string | null
  bio:          string | null
  teachingMode: keyof typeof MODE_LABEL
  subjects:     { subjectId: string; name: string; levels: string[] }[]
}

interface Props {
  teachers: TeacherDirItem[]
  basePath: string // ex: "/admin/professores" ou "/colaborador/professores"
}

export function TeachersDirectory({ teachers, basePath }: Props) {
  const [query,   setQuery]   = useState("")
  const [subject, setSubject] = useState("") // subjectId
  const [level,   setLevel]   = useState("") // EducationLevel

  // Matérias únicas presentes no corpo docente (para o seletor)
  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teachers) {
      for (const s of t.subjects) map.set(s.subjectId, s.name)
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [teachers])

  // Níveis realmente usados (mantém a ordem pedagógica)
  const levelOptions = useMemo(() => {
    const used = new Set<string>()
    for (const t of teachers) for (const s of t.subjects) for (const l of s.levels) used.add(l)
    return LEVEL_ORDER.filter(l => used.has(l))
  }, [teachers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teachers.filter(t => {
      if (q && !t.name.toLowerCase().includes(q)) return false
      if (!subject && !level) return true
      // A mesma matéria precisa satisfazer os dois filtros (matéria + ano)
      return t.subjects.some(s =>
        (!subject || s.subjectId === subject) &&
        (!level   || s.levels.includes(level))
      )
    })
  }, [teachers, query, subject, level])

  const hasFilter = Boolean(query || subject || level)

  return (
    <div className="space-y-4">
      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Busca por nome */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar professor pelo nome..."
              className="pl-9"
            />
          </div>

          {/* Matéria */}
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-56"
          >
            <option value="">Todas as matérias</option>
            {subjectOptions.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Nível/ano */}
        {levelOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
              <Filter className="w-3 h-3" /> Ano:
            </span>
            <button
              type="button"
              onClick={() => setLevel("")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                level === "" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Todos
            </button>
            {levelOptions.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(prev => prev === l ? "" : l)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  level === l ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {LEVEL_LABEL[l] ?? l}
              </button>
            ))}
            {hasFilter && (
              <button
                type="button"
                onClick={() => { setQuery(""); setSubject(""); setLevel("") }}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Contagem ────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} professor{filtered.length !== 1 ? "es" : ""}
        {hasFilter ? " no filtro" : " ativo" + (filtered.length !== 1 ? "s" : "")}
      </p>

      {/* ── Grade ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCircle className="w-10 h-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum professor corresponde ao filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => (
            <Link key={t.id} href={`${basePath}/${t.id}`} className="group block">
              <Card className="h-full hover:border-primary/40 hover:shadow-sm transition-all">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {t.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-7 h-7 text-primary/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">{t.name}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.email}</p>

                      <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${MODE_COLOR[t.teachingMode]}`}>
                        {MODE_ICON[t.teachingMode]} {MODE_LABEL[t.teachingMode]}
                      </span>
                    </div>
                  </div>

                  {t.bio && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{t.bio}</p>
                  )}

                  {t.subjects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.subjects.map(s => {
                        const isMatch = subject !== "" && s.subjectId === subject
                        return (
                          <div key={s.subjectId} className="flex flex-wrap items-center gap-1">
                            <Badge
                              variant={isMatch ? "default" : "secondary"}
                              className="text-[11px]"
                            >
                              {s.name}
                            </Badge>
                            {s.levels.map(l => {
                              const levelMatch = level !== "" && l === level
                              return (
                                <span
                                  key={l}
                                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    levelMatch
                                      ? "bg-primary/15 text-primary font-medium"
                                      : "text-muted-foreground bg-muted"
                                  }`}
                                >
                                  {LEVEL_LABEL[l] ?? l}
                                </span>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
