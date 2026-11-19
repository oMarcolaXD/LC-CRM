"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ShieldCheck, UserCog, Loader2 } from "lucide-react"
import { alterarNivelDeAcessoAction } from "../actions"
import { mensagemDeErro } from "@/lib/error-message"

const NIVEIS = [
  { value: "COLLABORATOR" as const, label: "Colaborador",   icon: UserCog,
    desc: "Agenda, alunos, agendamentos, recebimentos e cantina." },
  { value: "ADMIN"        as const, label: "Administrador", icon: ShieldCheck,
    desc: "Acesso total: financeiro, relatórios, usuários e configurações." },
]

export function NivelAcessoCard({ userId, nome, atual, ehVoce }: {
  userId: string
  nome:   string
  atual:  "ADMIN" | "COLLABORATOR"
  ehVoce: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function escolher(novo: "ADMIN" | "COLLABORATOR") {
    if (novo === atual || pending) return
    const texto = novo === "ADMIN"
      ? `Tornar ${nome} ADMINISTRADOR? Terá acesso total ao sistema, inclusive financeiro e usuários.`
      : `Tirar o acesso de administrador de ${nome}? Passa a ser colaborador.`
    if (!window.confirm(texto)) return
    start(async () => {
      try {
        await alterarNivelDeAcessoAction(userId, novo)
        toast.success(`${nome} agora é ${novo === "ADMIN" ? "administrador" : "colaborador"}. Vale a partir do próximo login.`)
        router.refresh()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível mudar o nível de acesso"))
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {NIVEIS.map(({ value, label, icon: Icon, desc }) => {
          const ativo = value === atual
          return (
            <button
              key={value}
              type="button"
              disabled={ehVoce || pending}
              onClick={() => escolher(value)}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                ativo ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50 disabled:opacity-60"
              }`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}{ativo && " · atual"}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          )
        })}
      </div>
      {pending && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</p>}
      <p className="text-xs text-muted-foreground">
        {ehVoce
          ? "Você não pode mudar o seu próprio nível — peça para outro administrador."
          : "A mudança vale quando a pessoa sair e entrar de novo no sistema."}
      </p>
    </div>
  )
}
