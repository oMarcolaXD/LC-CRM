import { Bell }          from "lucide-react"
import { Button }         from "@/components/ui/button"
import { MobileSidebar }  from "./mobile-sidebar"
import { LogoutButton }   from "./logout-button"
import type { Role }      from "@prisma/client"

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
}

interface HeaderProps {
  pathname: string
  name:     string
  email:    string
  role:     Role
  image?:   string | null
}

export function Header({ pathname, name, email, role, image }: HeaderProps) {
  const title = PAGE_TITLES[pathname] ?? "Lição de Casa"

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <MobileSidebar name={name} email={email} role={role} image={image} />
        <h2 className="font-sub font-semibold text-base text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="w-5 h-5" />
        </Button>
        <LogoutButton />
      </div>
    </header>
  )
}
