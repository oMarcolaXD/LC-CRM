import {
  LayoutDashboard, Users, CalendarDays, DollarSign,
  BarChart3, Settings, BookOpen, ClipboardList,
  GraduationCap, Wallet, FolderOpen, PenLine, Clock, School, UserPlus, Library, Target,
} from "lucide-react"
import type { Role } from "@prisma/client"

export interface NavLink {
  type?: "link"
  label: string
  href:  string
  icon:  React.ElementType
}

export interface NavSection {
  type:  "section"
  label: string
}

export type NavItem = NavLink | NavSection

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard",  href: "/admin/dashboard",  icon: LayoutDashboard },
    { type: "section", label: "Agenda" },
    { label: "Agenda",     href: "/admin/agenda",     icon: CalendarDays    },
    { type: "section", label: "Pessoas" },
    { label: "Alunos",      href: "/admin/alunos",      icon: GraduationCap   },
    { label: "Professores", href: "/admin/professores", icon: School          },
    { label: "Usuários",    href: "/admin/usuarios",    icon: Users           },
    { type: "section", label: "Gestão" },
    { label: "Financeiro", href: "/admin/financeiro", icon: DollarSign      },
    { label: "Relatórios", href: "/admin/relatorios", icon: BarChart3       },
    { label: "Metas",      href: "/admin/metas",      icon: Target          },
    { label: "Config.",    href: "/admin/config",     icon: Settings        },
  ],
  COLLABORATOR: [
    { label: "Dashboard",     href: "/colaborador/dashboard",     icon: LayoutDashboard },
    { type: "section", label: "Agenda" },
    { label: "Agenda",        href: "/colaborador/agenda",        icon: CalendarDays    },
    { label: "Agendamentos",  href: "/colaborador/agendamentos",  icon: ClipboardList   },
    { label: "Aulões",        href: "/colaborador/auloes",        icon: Library         },
    { type: "section", label: "Pessoas" },
    { label: "Alunos",        href: "/colaborador/alunos",        icon: GraduationCap   },
    { label: "Professores",   href: "/colaborador/professores",   icon: School          },
    { label: "Novo Cadastro", href: "/colaborador/usuarios/novo", icon: UserPlus        },
    { type: "section", label: "Gestão" },
    { label: "Financeiro",    href: "/colaborador/financeiro",    icon: DollarSign      },
  ],
  TEACHER: [
    { label: "Dashboard",       href: "/professor/dashboard",       icon: LayoutDashboard },
    { type: "section", label: "Agenda" },
    { label: "Minha Agenda",    href: "/professor/agenda",          icon: CalendarDays    },
    { label: "Disponibilidade", href: "/professor/disponibilidade", icon: Clock           },
    { type: "section", label: "Alunos" },
    { label: "Meus Alunos",     href: "/professor/alunos",          icon: GraduationCap   },
    { type: "section", label: "Conteúdo" },
    { label: "Materiais",       href: "/professor/materiais",       icon: FolderOpen      },
    { type: "section", label: "Financeiro" },
    { label: "Pagamentos",      href: "/professor/pagamentos",      icon: Wallet          },
  ],
  STUDENT: [
    { label: "Dashboard",    href: "/aluno/dashboard",  icon: LayoutDashboard },
    { type: "section", label: "Aulas" },
    { label: "Agendar Aula", href: "/aluno/agendar",    icon: CalendarDays    },
    { label: "Minhas Aulas", href: "/aluno/aulas",      icon: BookOpen        },
    { type: "section", label: "Conteúdo" },
    { label: "Materiais",    href: "/aluno/materiais",  icon: FolderOpen      },
    { label: "Lições",       href: "/aluno/licoes",     icon: PenLine         },
    { type: "section", label: "Financeiro" },
    { label: "Pagamentos",   href: "/aluno/pagamentos", icon: Wallet          },
  ],
  GUARDIAN: [
    { label: "Dashboard",   href: "/aluno/dashboard",  icon: LayoutDashboard },
    { type: "section", label: "Alunos" },
    { label: "Meus Alunos", href: "/aluno/alunos",     icon: GraduationCap   },
    { type: "section", label: "Aulas" },
    { label: "Agenda",      href: "/aluno/aulas",      icon: CalendarDays    },
    { type: "section", label: "Conteúdo" },
    { label: "Lições",      href: "/aluno/licoes",     icon: PenLine         },
    { type: "section", label: "Financeiro" },
    { label: "Pagamentos",  href: "/aluno/pagamentos", icon: Wallet          },
  ],
}
