"use client"

import { useTransition } from "react"
import { toast }         from "sonner"
import { Switch }        from "@/components/ui/switch"
import { toggleUserActiveAction } from "@/app/(admin)/admin/usuarios/actions"
import { mensagemDeErro } from "@/lib/error-message"

export function ToggleActiveButton({ id, active, name }: { id: string; active: boolean; name?: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Switch
      checked={active}
      disabled={pending}
      title={active ? "Ativo — clique para suspender o acesso" : "Suspenso — clique para reativar"}
      onCheckedChange={(val) => {
        if (!val && !window.confirm(`Suspender o acesso de ${name ?? "este usuário"}? A pessoa não consegue mais entrar no sistema (dá para reativar depois).`)) return
        startTransition(async () => {
          try {
            await toggleUserActiveAction(id, val)
            toast.success(val ? `${name ?? "Usuário"} reativado(a)` : `Acesso de ${name ?? "usuário"} suspenso`)
          } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível mudar o acesso"))
          }
        })
      }}
    />
  )
}
