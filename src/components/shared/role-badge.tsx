import { Badge } from "@/components/ui/badge"
import type { Role } from "@prisma/client"

const ROLE_CONFIG: Record<Role, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ADMIN:        { label: "Admin",        variant: "default"     },
  COLLABORATOR: { label: "Colaborador",  variant: "secondary"   },
  TEACHER:      { label: "Professor",    variant: "outline"     },
  STUDENT:      { label: "Aluno",        variant: "outline"     },
  GUARDIAN:     { label: "Responsável",  variant: "outline"     },
}

export function RoleBadge({ role }: { role: Role }) {
  const { label, variant } = ROLE_CONFIG[role]
  return <Badge variant={variant}>{label}</Badge>
}
