"use client"

import { useTransition }        from "react"
import { useRouter }            from "next/navigation"
import { ChevronDown, UserRound } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { selectStudentAction }   from "@/lib/actions/student-selector"

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
  const [, startTransition] = useTransition()
  const router = useRouter()
  const active = students.find((s) => s.id === activeStudentId) ?? students[0]

  if (!active) return null
  if (students.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-sub font-medium text-foreground">
        <UserRound className="w-4 h-4 text-primary shrink-0" />
        <span>{active.name}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 h-8 px-2 rounded-md text-sm font-sub font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <UserRound className="w-4 h-4 text-primary shrink-0" />
          <span className="max-w-[120px] truncate">{active.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <p className="px-2 py-1.5 text-xs text-muted-foreground font-normal">
          Selecionar aluno
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {students.map((s) => (
            <DropdownMenuItem
              key={s.id}
              className="cursor-pointer"
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await selectStudentAction(s.id)
                    if (result.ok) setTimeout(() => router.refresh(), 50)
                  } catch {
                    // evita propagação para o error boundary
                  }
                })
              }}
            >
              <div className="flex flex-col">
                <span className={s.id === activeStudentId ? "font-semibold" : ""}>
                  {s.name}
                </span>
                <span className="text-xs text-muted-foreground">{s.grade}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
