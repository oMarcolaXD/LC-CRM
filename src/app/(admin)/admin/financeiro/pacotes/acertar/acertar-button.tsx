"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { acertarPacotesAction } from "@/lib/actions/financeiro"
import { ouFalhe } from "@/lib/action-result"
import { mensagemDeErro } from "@/lib/error-message"

export function AcertarButton({ alunos, pacotes }: { alunos: number; pacotes: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function corrigir() {
    if (!confirm(`Corrigir ${pacotes} pacote(s) de ${alunos} aluno(s) exatamente como mostrado na lista?`)) return
    start(async () => {
      try {
        const r = ouFalhe(await acertarPacotesAction())
        toast.success(`${r.pacotes} pacote(s) corrigido(s) de ${r.alunos} aluno(s)`)
        router.refresh()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível corrigir os pacotes"))
      }
    })
  }

  return (
    <div className="flex justify-end">
      <Button onClick={corrigir} disabled={pending}>
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wrench className="mr-1.5 h-4 w-4" />}
        Corrigir {pacotes} pacote(s)
      </Button>
    </div>
  )
}
