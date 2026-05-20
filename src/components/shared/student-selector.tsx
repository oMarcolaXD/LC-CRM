"use client"

import { useTransition, useState, useEffect } from "react"
import { useRouter }                          from "next/navigation"
import { ChevronDown, GraduationCap, Check, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { selectStudentAction } from "@/lib/actions/student-selector"

interface StudentOption {
  id:    string
  name:  string
  grade: string
}

interface StudentSelectorProps {
  students:        StudentOption[]
  activeStudentId: string
}

export function StudentSelector({ students, activeStudentId }: StudentSelectorProps) {
  const [isPending, startTransition]   = useTransition()
  const router                         = useRouter()
  const [localActiveId, setLocalActiveId] = useState(activeStudentId)

  // Sincroniza quando o servidor confirma a troca (após router.refresh)
  useEffect(() => { setLocalActiveId(activeStudentId) }, [activeStudentId])

  const active = students.find((s) => s.id === localActiveId) ?? students[0]

  if (!active) return null

  /* 1 aluno — apenas badge sem dropdown */
  if (students.length === 1) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-primary/8 border border-primary/20 text-sm font-sub font-medium text-primary">
        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[130px] truncate">{active.name}</span>
      </div>
    )
  }

  /* 2+ alunos — dropdown */
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-primary/8 border border-primary/20 text-sm font-sub font-medium text-primary hover:bg-primary/15 transition-colors disabled:opacity-60"
      >
        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[120px] truncate">{active.name}</span>
        {isPending
          ? <Loader2 className="w-3 h-3 shrink-0 animate-spin opacity-70" />
          : <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
        }
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <p className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Trocar aluno
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {students.map((s) => {
            const isActive = s.id === localActiveId
            return (
              <DropdownMenuItem
                key={s.id}
                className="cursor-pointer gap-2"
                onClick={() => {
                  if (isActive) return
                  setLocalActiveId(s.id)          // feedback visual imediato
                  startTransition(async () => {
                    try {
                      const result = await selectStudentAction(s.id)
                      if (result.ok) {
                        await new Promise((r) => setTimeout(r, 50)) // deixa menu fechar
                        router.refresh()
                      } else {
                        setLocalActiveId(activeStudentId) // reverte se falhou
                      }
                    } catch {
                      setLocalActiveId(activeStudentId)
                    }
                  })
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isActive ? "font-semibold text-primary" : ""}`}>
                    {s.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.grade}</p>
                </div>
                {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
