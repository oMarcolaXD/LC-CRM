"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Cookie, Loader2, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { receberCantinaAction, excluirCantinaAction } from "@/lib/actions/colaborador"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

interface Venda {
  id: string; description: string; amount: number; soldAt: string
  fiado: boolean; paidAt: string | null; method: string | null
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/**
 * Cantina no perfil do aluno: o que ele pegou, o que já pagou e o que está
 * fiado. Separado do card "Financeiro" (aulas) de propósito.
 */
export function CantinaCard({ vendas, hoje, metodos }: { vendas: Venda[]; hoje: string; metodos: string[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [recebendo, setRecebendo] = useState<string | null>(null)
  const [metodo, setMetodo] = useState("")
  const [data, setData] = useState(hoje)
  const [verTudo, setVerTudo] = useState(false)

  const emAberto = vendas.filter((v) => v.fiado).reduce((s, v) => s + v.amount, 0)
  const totalGasto = vendas.reduce((s, v) => s + v.amount, 0)
  const lista = verTudo ? vendas : vendas.slice(0, 8)

  function receber(id: string) {
    start(async () => {
      try {
        ouFalhe(await receberCantinaAction({ id, method: metodo, paidAt: data }))
        toast.success("Fiado recebido")
        setRecebendo(null); setMetodo("")
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Não foi possível registrar o recebimento")) }
    })
  }

  function excluir(v: Venda) {
    if (!confirm(`Excluir o lançamento da cantina "${v.description}" de ${brl(v.amount)} (${v.soldAt})?`)) return
    start(async () => {
      try {
        ouFalhe(await excluirCantinaAction(v.id))
        toast.success("Lançamento da cantina excluído")
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Não foi possível excluir")) }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <Cookie className="w-4 h-4 text-primary" /> Cantina
            </CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Total {brl(totalGasto)}
              {emAberto > 0 && <> · <span className="font-semibold text-destructive">fiado em aberto {brl(emAberto)}</span></>}
            </p>
          </div>
          <Link href="/colaborador/financeiro/lancar" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted">
            <Plus className="h-3 w-3" /> Lançar
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {vendas.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Nada na cantina ainda.</p>}
        {lista.map((v) => (
          <div key={v.id} className="rounded-lg border border-border/70 px-2.5 py-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium break-words">{v.description}</p>
                <p className="text-[11px] text-muted-foreground">
                  {v.soldAt} · {v.fiado
                    ? <span className="font-semibold text-destructive">fiado</span>
                    : <>pago{v.paidAt && v.paidAt !== v.soldAt ? ` em ${v.paidAt}` : ""}{v.method ? ` · ${v.method}` : ""}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="font-semibold tabular-nums">{brl(v.amount)}</span>
                <button type="button" onClick={() => excluir(v)} disabled={pending} title="Excluir lançamento"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {v.fiado && (recebendo === v.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
                  className="h-7 rounded-md border border-input bg-background px-2 text-[11px]">
                  <option value="">Forma…</option>
                  {metodos.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)}
                  className="h-7 rounded-md border border-input bg-background px-2 text-[11px]" />
                <Button size="sm" className="h-7 px-2 text-[11px]" disabled={pending || !metodo} onClick={() => receber(v.id)}>
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                </Button>
                <button type="button" onClick={() => setRecebendo(null)} className="text-[11px] text-muted-foreground hover:text-foreground">cancelar</button>
              </div>
            ) : (
              <button type="button" onClick={() => { setRecebendo(v.id); setMetodo(""); setData(hoje) }}
                className="mt-1.5 text-[11px] font-medium text-primary hover:underline">
                Receber fiado
              </button>
            ))}
          </div>
        ))}
        {vendas.length > 8 && (
          <button type="button" onClick={() => setVerTudo((x) => !x)} className="w-full pt-1 text-center text-[11px] text-muted-foreground hover:text-foreground">
            {verTudo ? "Mostrar menos" : `Ver todos (${vendas.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
