"use client"

import { signOut }    from "next-auth/react"
import { useRouter }  from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User } from "lucide-react"
const ROLE_LABEL: Record<string, string> = {
  ADMIN:        "Administrador",
  COLLABORATOR: "Colaborador",
  TEACHER:      "Professor",
  STUDENT:      "Aluno",
  GUARDIAN:     "Responsável",
}

const PROFILE_PATH: Record<string, string> = {
  ADMIN:        "/admin/perfil",
  COLLABORATOR: "/colaborador/perfil",
  TEACHER:      "/professor/perfil",
  STUDENT:      "/aluno/perfil",
  GUARDIAN:     "/aluno/perfil",
}

interface UserMenuProps {
  name:   string
  email:  string
  role:   string
  image?: string | null
}

export function UserMenu({ name, email, role, image }: UserMenuProps) {
  const router   = useRouter()
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left outline-none">
        <span className="contents">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={image ?? undefined} alt={name} />
            <AvatarFallback className="bg-primary text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{ROLE_LABEL[role]}</p>
          </div>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground font-normal">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(PROFILE_PATH[role] ?? "#")}>
          <User className="w-4 h-4 mr-2" />
          Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
