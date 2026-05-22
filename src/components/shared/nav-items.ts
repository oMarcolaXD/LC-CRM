import {
  LayoutDashboard, Users, CalendarDays, DollarSign,
  BarChart3, Settings, BookOpen, ClipboardList,
  GraduationCap, Wallet, FolderOpen, PenLine, Clock, UserCircle, School, UserPlus,
} from "lucide-react"
import type { Role } from "@prisma/client"

export interface NavItem {
  label: string
  href:  string
  icon:  React.ElementType
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard",   href: "/admin/dashboard",  icon: LayoutDashboard },
    { label: "Usuários",    href: "/admin/usuarios",   icon: Users           },
    { label: "Alunos",      href: "/admin/alunos",     icon: GraduationCap   },
    { label: "Agenda",      href: "/admin/agenda",     icon: CalendarDays    },
    { label: "Financeiro",  href: "/admin/financeiro", icon: DollarSign      },
    { label: "Relatórios",  href: "/admin/relatorios", icon: BarChart3       },
    { label: "Config.",     href: "/admin/config",     icon: Settings        },
    { label: "Meu Perfil",  href: "/admin/perfil",     icon: UserCircle      },
  ],
  COLLABORATOR: [
    { label: "Dashboard",      href: "/colaborador/dashboard",        icon: LayoutDashboard },
    { label: "Agenda",         href: "/colaborador/agenda",           icon: CalendarDays    },
    { label: "Alunos",         href: "/colaborador/alunos",           icon: GraduationCap   },
    { label: "Professores",    href: "/colaborador/professores",      icon: School          },
    { label: "Novo Usuário",   href: "/colaborador/usuarios/novo",    icon: UserPlus        },
    { label: "Agendamentos",   href: "/colaborador/agendamentos",     icon: ClipboardList   },
    { label: "Financeiro",     href: "/colaborador/financeiro",       icon: DollarSign      },
    { label: "Meu Perfil",     href: "/colaborador/perfil",           icon: UserCircle      },
  ],
  TEACHER: [
    { label: "Dashboard",      href: "/professor/dashboard",      icon: LayoutDashboard },
    { label: "Minha Agenda",   href: "/professor/agenda",         icon: CalendarDays    },
    { label: "Disponibilidade",href: "/professor/disponibilidade",icon: Clock           },
    { label: "Meus Alunos",    href: "/professor/alunos",         icon: GraduationCap   },
    { label: "Pagamentos",     href: "/professor/pagamentos",     icon: Wallet          },
    { label: "Materiais",      href: "/professor/materiais",      icon: FolderOpen      },
    { label: "Meu Perfil",     href: "/professor/perfil",         icon: UserCircle      },
  ],
  STUDENT: [
    { label: "Dashboard",    href: "/aluno/dashboard",  icon: LayoutDashboard },
    { label: "Agendar Aula", href: "/aluno/agendar",    icon: CalendarDays    },
    { label: "Minhas Aulas", href: "/aluno/aulas",      icon: BookOpen        },
    { label: "Materiais",    href: "/aluno/materiais",  icon: FolderOpen      },
    { label: "Lições",       href: "/aluno/licoes",     icon: PenLine         },
    { label: "Pagamentos",   href: "/aluno/pagamentos", icon: Wallet          },
    { label: "Meu Perfil",   href: "/aluno/perfil",     icon: UserCircle      },
  ],
  GUARDIAN: [
    { label: "Dashboard",    href: "/aluno/dashboard",  icon: LayoutDashboard },
    { label: "Meus Alunos",  href: "/aluno/alunos",     icon: GraduationCap   },
    { label: "Agenda",       href: "/aluno/aulas",      icon: CalendarDays    },
    { label: "Pagamentos",   href: "/aluno/pagamentos", icon: Wallet          },
    { label: "Meu Perfil",   href: "/aluno/perfil",     icon: UserCircle      },
  ],
}
