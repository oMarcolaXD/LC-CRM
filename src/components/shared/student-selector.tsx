"use client"

import { useTransition }        from "react"
import { usePathname }          from "next/navigation"
import { ChevronDown, UserRound } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const pathname = usePathname()
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
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Selecionar aluno
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {students.map((s) => (
          <DropdownMenuItem
            key={s.id}
            className="cursor-pointer"
            onSelect={() => {
              startTransition(async () => {
                try {
                  await selectStudentAction(s.id, pathname)
                } catch {
                  // redirect() lança internamente — o Next.js processa a navegação
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
