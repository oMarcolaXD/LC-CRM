import { auth }    from "@/lib/auth"
import { signOut } from "@/lib/auth"
import { Button }  from "@/components/ui/button"

export default async function AdminDashboard() {
  const session = await auth()

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="font-heading text-4xl text-foreground">PAINEL ADMIN</h1>
        <p className="text-muted-foreground font-body">
          Bem-vindo, <strong>{session?.user?.name}</strong>!
        </p>
        <p className="text-sm text-muted-foreground">
          Dashboard completo será implementado na Etapa 9.
        </p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
          <Button variant="outline" type="submit">Sair</Button>
        </form>
      </div>
    </div>
  )
}
