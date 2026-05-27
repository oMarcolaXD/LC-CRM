import { Sidebar }              from "./sidebar"
import { Header }               from "./header"
import { WhatsAppButton }       from "./whatsapp-button"
import { EmailMissingBanner }   from "./email-missing-banner"
import { DevBanner }            from "./dev-banner"
import { NavigationProgress }   from "./navigation-progress"
import type { Role }            from "@prisma/client"

interface StudentOption {
  id:    string
  name:  string
  grade: string
}

interface AppLayoutProps {
  children:         React.ReactNode
  name:             string
  email:            string
  role:             Role
  image?:           string | null
  phone?:           string | null
  missingEmail?:    boolean
  allStudents?:     StudentOption[]
  activeStudentId?: string
}

export async function AppLayout({ children, name, email, role, image, phone, missingEmail, allStudents, activeStudentId }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      <NavigationProgress />
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col">
        <Sidebar name={name} email={email} role={role} image={image} phone={phone} />
      </aside>

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          name={name}
          email={email}
          role={role}
          image={image}
          phone={phone}
          allStudents={allStudents}
          activeStudentId={activeStudentId}
        />
        <DevBanner />
        {missingEmail && <EmailMissingBanner role={role} />}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <WhatsAppButton />
    </div>
  )
}
