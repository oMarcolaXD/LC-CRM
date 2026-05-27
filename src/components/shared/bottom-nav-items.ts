import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  DollarSign,
  FolderOpen,
  Wallet,
  School,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  Library,
  UserPlus,
  Clock,
  PenLine,
  BookOpen,
  Target,
} from "lucide-react"
import type { Role } from "@prisma/client"
import type { ElementType } from "react"

export interface BottomPrimary {
  label:        string
  href:         string
  icon:         ElementType
  matchPrefix?: string
}

export interface BottomNavConfig {
  primary:  BottomPrimary[]
  overflow: BottomPrimary[]
}

export const BOTTOM_NAV: Record<Role, BottomNavConfig> = {
  ADMIN: {
    primary: [
      { label: "Início",      href: "/admin/dashboard",   icon: LayoutDashboard },
      { label: "Agenda",      href: "/admin/agenda",      icon: CalendarDays,   matchPrefix: "/admin/agenda"      },
      { label: "Alunos",      href: "/admin/alunos",      icon: GraduationCap,  matchPrefix: "/admin/alunos"      },
      { label: "Financeiro",  href: "/admin/financeiro",  icon: DollarSign,     matchPrefix: "/admin/financeiro"  },
    ],
    overflow: [
      { label: "Professores", href: "/admin/professores", icon: School    },
      { label: "Usuários",    href: "/admin/usuarios",    icon: Users     },
      { label: "Relatórios",  href: "/admin/relatorios",  icon: BarChart3 },
      { label: "Metas",       href: "/admin/metas",       icon: Target    },
      { label: "Config.",     href: "/admin/config",      icon: Settings  },
    ],
  },

  COLLABORATOR: {
    primary: [
      { label: "Início",     href: "/colaborador/dashboard",   icon: LayoutDashboard },
      { label: "Agenda",     href: "/colaborador/agenda",      icon: CalendarDays,  matchPrefix: "/colaborador/agenda"     },
      { label: "Alunos",     href: "/colaborador/alunos",      icon: GraduationCap, matchPrefix: "/colaborador/alunos"     },
      { label: "Financeiro", href: "/colaborador/financeiro",  icon: DollarSign,    matchPrefix: "/colaborador/financeiro" },
    ],
    overflow: [
      { label: "Agendamentos",  href: "/colaborador/agendamentos",  icon: ClipboardList },
      { label: "Aulões",        href: "/colaborador/auloes",        icon: Library       },
      { label: "Professores",   href: "/colaborador/professores",   icon: School        },
      { label: "Novo Cadastro", href: "/colaborador/usuarios/novo", icon: UserPlus      },
    ],
  },

  TEACHER: {
    primary: [
      { label: "Início",    href: "/professor/dashboard",  icon: LayoutDashboard },
      { label: "Agenda",    href: "/professor/agenda",     icon: CalendarDays,  matchPrefix: "/professor/agenda"    },
      { label: "Alunos",    href: "/professor/alunos",     icon: GraduationCap, matchPrefix: "/professor/alunos"    },
      { label: "Materiais", href: "/professor/materiais",  icon: FolderOpen,    matchPrefix: "/professor/materiais" },
    ],
    overflow: [
      { label: "Disponibilidade", href: "/professor/disponibilidade", icon: Clock  },
      { label: "Pagamentos",      href: "/professor/pagamentos",      icon: Wallet },
    ],
  },

  STUDENT: {
    primary: [
      { label: "Início",    href: "/aluno/dashboard",  icon: LayoutDashboard },
      { label: "Agendar",   href: "/aluno/agendar",    icon: CalendarDays,  matchPrefix: "/aluno/agendar"   },
      { label: "Materiais", href: "/aluno/materiais",  icon: FolderOpen,    matchPrefix: "/aluno/materiais" },
      { label: "Pagamentos",href: "/aluno/pagamentos", icon: Wallet,        matchPrefix: "/aluno/pagamentos"},
    ],
    overflow: [
      { label: "Minhas Aulas", href: "/aluno/aulas",   icon: BookOpen },
      { label: "Lições",       href: "/aluno/licoes",  icon: PenLine  },
    ],
  },

  GUARDIAN: {
    primary: [
      { label: "Início",    href: "/aluno/dashboard",  icon: LayoutDashboard },
      { label: "Agenda",    href: "/aluno/aulas",      icon: CalendarDays,  matchPrefix: "/aluno/aulas"     },
      { label: "Materiais", href: "/aluno/materiais",  icon: FolderOpen,    matchPrefix: "/aluno/materiais" },
      { label: "Pagamentos",href: "/aluno/pagamentos", icon: Wallet,        matchPrefix: "/aluno/pagamentos"},
    ],
    overflow: [
      { label: "Meus Alunos", href: "/aluno/alunos",  icon: GraduationCap },
      { label: "Lições",      href: "/aluno/licoes",  icon: PenLine       },
    ],
  },
}
