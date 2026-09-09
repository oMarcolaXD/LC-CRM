"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ModoBadge } from "@/components/shared/modo-badge"
import { Search, BookOpen, GraduationCap } from "lucide-react"
import { fmtAulas } from "@/lib/lessons"

export type AlunoProf = {
  id:              string
  name:            string
  initials:        string
  grade:           string
  totalAulas:      number
  aulasCompletas:  number
  lastAulaLabel:   string
  lastContent:     string
  modo:            "sede" | "online"
  remainingLessons: number | null
  packageStatus:   "ok" | "renovar" | "esgotado" | "sem-pacote"
  pendingHomework: number
  lastLessonId:    string | null
}

const PKG_STYLE: Record<AlunoProf["packageStatus"], { label: string; bg: string; color: string }> = {
  ok:         { label: "Em dia",    bg: "var(--success-soft)", color: "var(--success)" },
  renovar:    { label: "Renovar",   bg: "var(--warn-soft)",    color: "var(--warn)"    },
  esgotado:   { label: "Esgotado",  bg: "var(--danger-soft)",  color: "var(--danger)"  },
  "sem-pacote": { label: "Sem pacote", bg: "var(--muted-soft)", color: "var(--subtle)" },
}

interface Props {
  alunos: AlunoProf[]
}

export function AlunosTable({ alunos }: Props) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return alunos
    return alunos.filter(
      a => a.name.toLowerCase().includes(q) || a.grade.toLowerCase().includes(q)
    )
  }, [alunos, query])

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={14}
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar aluno ou série…"
          className="w-full rounded-[8px] border border-border bg-card py-[8px] pl-8 pr-4 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-0"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[12px]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <GraduationCap className="text-muted-foreground" size={36} />
          <p className="text-[14px] font-medium">
            {query ? "Nenhum aluno encontrado" : "Nenhum aluno ainda"}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {query
              ? "Tente outro nome ou série"
              : "Seus alunos aparecerão aqui quando você tiver aulas agendadas"}
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                <th className="border-b border-border px-[14px] py-[9px] font-medium">Aluno</th>
                <th className="border-b border-border px-[14px] py-[9px] font-medium">Conteúdo atual</th>
                <th className="border-b border-border px-[14px] py-[9px] text-center font-medium">Aulas</th>
                <th className="border-b border-border px-[14px] py-[9px] font-medium">Pacote</th>
                <th className="border-b border-border px-[14px] py-[9px] font-medium">Última aula</th>
                <th className="border-b border-border px-[14px] py-[9px] font-medium">Modo</th>
                <th className="border-b border-border px-[14px] py-[9px] text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const pkg = PKG_STYLE[a.packageStatus]
                return (
                  <tr key={a.id} className="border-t border-border transition-colors hover:bg-[var(--hover)]">
                    {/* Aluno */}
                    <td className="px-[14px] py-[10px]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, var(--primary), #ea580c)" }}
                        >
                          {a.initials}
                        </div>
                        <div className="leading-[1.3]">
                          <div className="font-medium">{a.name}</div>
                          <div className="text-[10.5px] text-muted-foreground">{a.grade}</div>
                        </div>
                      </div>
                    </td>

                    {/* Conteúdo */}
                    <td className="max-w-[200px] px-[14px] py-[10px]">
                      <span className="line-clamp-1 block" style={{ color: "var(--text-2)" }}>
                        {a.lastContent || "—"}
                      </span>
                    </td>

                    {/* Aulas */}
                    <td className="px-[14px] py-[10px] text-center">
                      <span className="font-mono text-[12px] font-semibold">{fmtAulas(a.aulasCompletas)}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">/{fmtAulas(a.totalAulas)}</span>
                    </td>

                    {/* Pacote */}
                    <td className="px-[14px] py-[10px]">
                      <div className="flex flex-col gap-[2px]">
                        <span
                          className="inline-block w-fit rounded-[4px] px-[7px] py-[2px] font-mono text-[10.5px] font-semibold"
                          style={{ background: pkg.bg, color: pkg.color }}
                        >
                          {pkg.label}
                        </span>
                        {a.remainingLessons != null && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {a.remainingLessons} restante{a.remainingLessons !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Última aula */}
                    <td className="px-[14px] py-[10px]">
                      <div className="leading-[1.3]">
                        <div className="text-muted-foreground">{a.lastAulaLabel}</div>
                        {a.pendingHomework > 0 && (
                          <div className="flex items-center gap-1 text-[10.5px]" style={{ color: "var(--warn)" }}>
                            <BookOpen size={10} />
                            {a.pendingHomework} lição pendente{a.pendingHomework !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Modo */}
                    <td className="px-[14px] py-[10px]">
                      <ModoBadge modo={a.modo} size="sm" />
                    </td>

                    {/* Ações */}
                    <td className="px-[14px] py-[10px] text-right">
                      <div className="flex items-center justify-end gap-3">
                        {a.lastLessonId && (
                          <Link
                            href={`/professor/agenda/${a.lastLessonId}`}
                            className="text-[11.5px] font-medium transition-opacity hover:opacity-70"
                            style={{ color: "var(--primary)" }}
                          >
                            + Lição
                          </Link>
                        )}
                        <Link
                          href={`/professor/agenda`}
                          className="text-[11.5px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
                        >
                          Agenda →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
