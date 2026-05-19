import { MobileSidebar }       from "./mobile-sidebar"
import { LogoutButton }        from "./logout-button"
import { NotificationBell }    from "./notification-bell"
import { ThemeToggle }         from "./theme-toggle"
import { StudentSelector }     from "./student-selector"
import type { Role }           from "@prisma/client"

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard":          "Dashboard",
  "/admin/usuarios":           "Usuários",
  "/admin/agenda":             "Agenda",
  "/admin/financeiro":         "Financeiro",
  "/admin/relatorios":         "Relatórios",
  "/colaborador/dashboard":    "Dashboard",
  "/colaborador/agenda":       "Agenda",
  "/colaborador/alunos":       "Alunos",
  "/colaborador/agendamentos": "Agendamentos",
  "/professor/dashboard":      "Dashboard",
  "/professor/agenda":         "Minha Agenda",
  "/professor/alunos":         "Meus Alunos",
  "/professor/pagamentos":     "Pagamentos",
  "/professor/materiais":      "Materiais",
  "/aluno/dashboard":          "Dashboard",
  "/aluno/agendar":            "Agendar Aula",
  "/aluno/aulas":              "Minhas Aulas",
  "/aluno/materiais":          "Materiais",
  "/aluno/licoes":             "Lições de Casa",
  "/admin/perfil":             "Meu Perfil",
  "/colaborador/perfil":       "Meu Perfil",
  "/professor/perfil":         "Meu Perfil",
  "/aluno/perfil":             "Meu Perfil",
}

interface StudentOption {
  id:    string
  name:  string
  grade: string
}

interface HeaderProps {
  pathname:         string
  name:             string
  email:            string
  role:             Role
  image?:           string | null
  phone?:           string | null
  allStudents?:     StudentOption[]
  activeStudentId?: string
}

export function Header({ pathname, name, email, role, image, phone, allStudents, activeStudentId }: HeaderProps) {
  const title = PAGE_TITLES[pathname] ?? "Lição de Casa"

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <MobileSidebar name={name} email={email} role={role} image={image} phone={phone} />
        <h2 className="font-sub font-semibold text-base text-foreground">{title}</h2>
      </div>

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
