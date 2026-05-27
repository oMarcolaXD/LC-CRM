"use client"

import { LogoutButton }        from "./logout-button"
import { NotificationBell }    from "./notification-bell"
import { ThemeToggle }         from "./theme-toggle"
import { StudentSelector }     from "./student-selector"
import type { Role }           from "@prisma/client"

interface StudentOption {
  id:    string
  name:  string
  grade: string
}

interface HeaderProps {
  role:             Role
  allStudents?:     StudentOption[]
  activeStudentId?: string
}

export function Header({ role, allStudents, activeStudentId }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-end px-4 gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {role === "GUARDIAN" && allStudents && allStudents.length > 0 && activeStudentId && (
          <StudentSelector students={allStudents} activeStudentId={activeStudentId} />
        )}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
