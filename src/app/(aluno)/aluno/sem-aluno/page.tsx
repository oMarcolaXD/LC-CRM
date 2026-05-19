import { auth }       from "@/lib/auth"
import { redirect }   from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Phone } from "lucide-react"

export default async function SemAlunoPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-2xl">Nenhum aluno vinculado</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Sua conta ainda não possui alunos vinculados. Entre em contato com a escola para que o vínculo seja realizado.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <a
              href="https://wa.me/5515996279639"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:underline"
            >
              Falar com o suporte pelo WhatsApp
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
