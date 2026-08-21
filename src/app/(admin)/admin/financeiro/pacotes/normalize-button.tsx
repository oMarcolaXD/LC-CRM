"use client"

// Alinha o status gravado dos pacotes com a realidade (sem saldo → esgotado,
// fora do prazo → expirado). As telas já derivam a situação pela data, então
// isto não muda número nenhum — serve para o banco parar de contar história
// diferente da tela.

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { normalizePackagesAction } from "@/lib/actions/financeiro"
import { ouFalhe } from "@/lib/action-result"
import { mensagemDeErro } from "@/lib/error-message"
import { Loader2, Wand2 } from "lucide-react"

export function NormalizeButton() {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const r = ouFalhe(await normalizePackagesAction())
            const total = r.esgotados + r.expirados
            toast.success(
              total === 0
                ? "Nenhum pacote precisava de ajuste"
                : `${r.esgotados} esgotado(s) e ${r.expirados} expirado(s) atualizados`,
            )
            router.refresh()
          } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao normalizar"))
          }
        })
      }
      title="Marca como esgotado o que zerou e como expirado o que passou do prazo"
    >
      {pending
        ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        : <Wand2 className="mr-1 h-4 w-4" />}
      Ajustar status
    </Button>
  )
}
