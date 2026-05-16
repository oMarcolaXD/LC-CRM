import Link from "next/link"
import { CheckCircle2, CalendarDays, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AgendarSucessoPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6">
      <div className="text-center max-w-md space-y-6">
        {/* Ícone */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <h1 className="font-heading text-2xl text-foreground">
            Solicitação enviada!
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Recebemos o seu pedido de agendamento. Nossa equipe vai analisar a disponibilidade e confirmar sua aula em breve.
          </p>
        </div>

        {/* Cards informativos */}
        <div className="bg-muted/50 rounded-2xl p-5 space-y-3 text-left border">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">O que acontece agora?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O professor receberá uma notificação e confirmará o horário. Você será avisado assim que a aula for confirmada.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Fique de olho!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A confirmação chegará pelo WhatsApp e e-mail cadastrados. Caso não receba em 24h, entre em contato conosco.
              </p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/aluno/aulas">Ver minhas aulas</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/aluno/dashboard">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
