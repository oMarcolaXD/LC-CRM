import { headers }        from "next/headers"
import { Sidebar }        from "./sidebar"
import { Header }         from "./header"
import { WhatsAppButton } from "./whatsapp-button"
import type { Role }      from "@prisma/client"

interface AppLayoutProps {
  children: React.ReactNode
  name:     string
  email:    string
  role:     Role
  image?:   string | null
  phone?:   string | null
}

export async function AppLayout({ children, name, email, role, image, phone }: AppLayoutProps) {
  const headerList = await headers()
  const pathname   = headerList.get("x-pathname") ?? ""

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col">
        <Sidebar name={name} email={email} role={role} image={image} phone={phone} />
      </aside>

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header pathname={pathname} name={name} email={email} role={role} image={image} phone={phone} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <WhatsAppButton />
    </div>
  )
}
