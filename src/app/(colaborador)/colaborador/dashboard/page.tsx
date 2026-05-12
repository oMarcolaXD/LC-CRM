import { auth }    from "@/lib/auth"
import { signOut } from "@/lib/auth"
import { Button }  from "@/components/ui/button"

export default async function ColaboradorDashboard() {
  const session = await auth()
  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="font-heading text-4xl">PAINEL COLABORADOR</h1>
        <p className="text-muted-foreground">Bem-vindo, <strong>{session?.user?.name}</strong>!</p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
          <Button variant="outline" type="submit">Sair</Button>
        </form>
      </div>
    </div>
  )
}
