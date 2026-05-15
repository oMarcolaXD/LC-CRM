import { NavLogo }    from "./nav-logo"
import { SidebarNav } from "./sidebar-nav"
import { UserMenu }   from "./user-menu"
import { Separator }  from "@/components/ui/separator"
import type { Role }  from "@prisma/client"

interface SidebarProps {
  name:       string
  email:      string
  role:       Role
  image?:     string | null
  onNavigate?: () => void
}

export function Sidebar({ name, email, role, image, onNavigate }: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-4 py-5">
        <NavLogo />
      </div>

      <Separator />

      {/* Navegação */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav role={role} onNavigate={onNavigate} />
      </div>

      <Separator />

      {/* Usuário */}
      <div className="p-3">
        <UserMenu name={name} email={email} role={role} image={image} onBeforeOpen={onNavigate} />
      </div>
    </div>
  )
}
