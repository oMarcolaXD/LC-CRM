"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SearchSelect } from "@/components/shared/search-list"
import { lancarRecebimentosAction } from "@/lib/actions/colaborador"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"

interface Aluno   { id: string; name: string; guardianName: string | null }
interface Aberta  { id: string; studentId: string; amount: number; due: string; vencida: boolean; label: string }
interface Recente { studentId: string; amount: number; dia: string }

interface Linha {
  key:       number
  tipo:      "aulas" | "cantina"
  item:      string          // só cantina: o que o aluno pegou
  fiado:     boolean         // só cantina: pega agora, paga depois
  parcelas:  number          // cartão de crédito em N vezes (aulas)
  obs:       string          // observação livre
  studentId: string
  valor:     string          // como digitado ("150", "150,50", "1.500,00")
  paidAt:    string          // YYYY-MM-DD
  method:    string
  /** "" = automático (sugestão); "avulso" = sem cobrança; senão id da cobrança */
  destino:   string
}

const AVULSO = "avulso"
const CARTAO = "Cartão de crédito"

/** "YYYY-MM-DD" + n meses → "dd/MM/yyyy" (prévia das parcelas do cartão). */
function maisMeses(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  return `${String(Math.min(d, ultimo)).padStart(2, "0")}/${String(alvo.getUTCMonth() + 1).padStart(2, "0")}/${alvo.getUTCFullYear()}`
}

/** Mesma divisão do servidor (dividirParcelas): a 1ª parcela absorve os centavos. */
function partes(total: number, n: number): number[] {
  const c = Math.round(total * 100), base = Math.floor(c / n), resto = c - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? resto : 0)) / 100)
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** "1.500,50" → 1500.5 · "150.5" → 150.5 · inválido → NaN */
function lerValor(s: string): number {
  const t = s.replace(/[R$\s]/g, "")
  if (!t) return NaN
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t
  const n = Number(normal)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

const igual = (a: number, b: number) => Math.abs(a - b) < 0.009

export function LancarRecebimentosForm({ hoje, metodos, alunos, abertas, recentes }: {
  hoje: string; metodos: string[]; alunos: Aluno[]; abertas: Aberta[]; recentes: Recente[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [revisando, setRevisando] = useState(false)
  const [seq, setSeq] = useState(1)
  const nova = (key: number, base?: Partial<Linha>): Linha => ({
    key, tipo: base?.tipo ?? "aulas", item: "", fiado: false, parcelas: 1, obs: "",
    studentId: "", valor: "", paidAt: hoje, method: base?.method ?? "", destino: "",
  })
  const [linhas, setLinhas] = useState<Linha[]>([nova(0)])

  const alunoPorId    = useMemo(() => new Map(alunos.map((a) => [a.id, a])), [alunos])
  const abertasPorAluno = useMemo(() => {
    const m = new Map<string, Aberta[]>()
    for (const a of abertas) m.set(a.studentId, [...(m.get(a.studentId) ?? []), a])
    return m
  }, [abertas])
  const itensAluno = useMemo(() => alunos.map((a) => ({
    id: a.id, label: a.name, hint: a.guardianName ? `Resp: ${a.guardianName}` : null,
  })), [alunos])

  function atualizar(key: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  /** Destino efetivo: escolha manual, ou a cobrança em aberto de mesmo valor (mais antiga) ainda livre. */
  const resolvidas = useMemo(() => {
    const usadas = new Set<string>()
    // Escolhas manuais reservam primeiro
    for (const l of linhas) if (l.tipo === "aulas" && l.destino && l.destino !== AVULSO) usadas.add(l.destino)
    return linhas.map((l) => {
      const valor = lerValor(l.valor)
      if (l.tipo === "cantina") {
        const problema =
          !l.studentId                          ? "Escolha o aluno" :
          !l.item.trim()                        ? "Informe o item da cantina" :
          !Number.isFinite(valor) || valor <= 0 ? "Informe o valor" :
          !l.paidAt                             ? "Informe a data" :
          !l.fiado && !l.method                 ? "Informe a forma de pagamento (ou marque fiado)" :
          null
        return { ...l, valorNum: valor, destinoFinal: AVULSO, cobranca: null as Aberta | null, repetido: false, problema, restante: 0 }
      }
      let destino = l.destino
      if (!destino && l.studentId && Number.isFinite(valor)) {
        const sugestao = (abertasPorAluno.get(l.studentId) ?? []).find((a) => igual(a.amount, valor) && !usadas.has(a.id))
        destino = sugestao ? sugestao.id : AVULSO
        if (sugestao) usadas.add(sugestao.id)
      }
      const cobranca = destino && destino !== AVULSO ? abertas.find((a) => a.id === destino) ?? null : null
      const repetido = !!l.studentId && Number.isFinite(valor) &&
        recentes.some((r) => r.studentId === l.studentId && igual(r.amount, valor) && r.dia === l.paidAt)
      const problema =
        !l.studentId                       ? "Escolha o aluno" :
        !Number.isFinite(valor) || valor <= 0 ? "Informe o valor" :
        !l.paidAt                          ? "Informe a data" :
        !l.method                          ? "Informe a forma de pagamento" :
        cobranca && valor > cobranca.amount + 0.009
          ? "Valor maior que a cobrança. Faça o ajuste manualmente no perfil do aluno (anote nas observações)." :
        null
      const restante = cobranca && Number.isFinite(valor) ? Math.round((cobranca.amount - valor) * 100) / 100 : 0
      return { ...l, valorNum: valor, destinoFinal: destino || AVULSO, cobranca, repetido, problema, restante: restante > 0.009 ? restante : 0 }
    })
  }, [linhas, abertas, abertasPorAluno, recentes])

  const validas = resolvidas.filter((r) => !r.problema)
  const total   = validas.reduce((s, r) => s + r.valorNum, 0)
  const totalCantina = validas.filter((r) => r.tipo === "cantina").reduce((s, r) => s + r.valorNum, 0)
  const podeRevisar = resolvidas.length > 0 && resolvidas.every((r) => !r.problema)

  function adicionar() {
    const ultima = linhas[linhas.length - 1]
    setLinhas((ls) => [...ls, nova(seq, { method: ultima?.method, tipo: ultima?.tipo })])
    setSeq((s) => s + 1)
  }

  function lancar() {
    start(async () => {
      try {
        const r = ouFalhe(await lancarRecebimentosAction(resolvidas.map((l) => ({
          tipo:        l.tipo,
          studentId:   l.studentId,
          amount:      l.valorNum,
          paidAt:      l.paidAt,
          method:      l.tipo === "cantina" && l.fiado ? undefined : l.method,
          paymentId:   l.tipo === "aulas" && l.destinoFinal !== AVULSO ? l.destinoFinal : null,
          description: l.tipo === "cantina" ? l.item.trim() : undefined,
          fiado:       l.tipo === "cantina" ? l.fiado : undefined,
          parcelasCartao: l.tipo === "aulas" && l.method === CARTAO ? l.parcelas : undefined,
          obs:         l.obs.trim() || undefined,
        }))))
        toast.success(`${r.quitadas + r.avulsos + r.cantina} lançamento(s) — ${brl(r.total)}`)
        setLinhas([nova(seq)])
        setSeq((s) => s + 1)
        setRevisando(false)
        router.refresh()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível lançar os recebimentos"))
      }
    })
  }

  // ── Revisão antes de gravar ────────────────────────────────────────────────
  if (revisando) {
    return (
      <div className="mb-24 space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="font-semibold">Confira antes de lançar</p>
          <p className="text-xs text-muted-foreground">Nada foi gravado ainda. Os lançamentos vão direto para o perfil de cada aluno.</p>
        </div>
        <ul className="divide-y rounded-lg border border-border">
          {resolvidas.map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{i + 1}. {alunoPorId.get(r.studentId)?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.tipo === "cantina"
                    ? <>🍪 <strong>Cantina</strong>: {r.item}{r.fiado ? " · FIADO (fica em aberto no perfil)" : ` · ${r.method}`} · {r.paidAt.split("-").reverse().join("/")}</>
                    : <>
                        {r.cobranca
                          ? <>Quita a cobrança <strong>{r.cobranca.label}</strong> (venc. {r.cobranca.due})</>
                          : <>Pagamento avulso</>}
                        {" · "}{r.method}{r.method === CARTAO && r.parcelas > 1 ? ` em ${r.parcelas}x` : ""} · {r.paidAt.split("-").reverse().join("/")}
                      </>}
                </p>
                {r.tipo === "aulas" && r.restante > 0 && (
                  <p className="text-xs text-amber-600">Parcial: {brl(r.restante)} continua em aberto.</p>
                )}
                {r.tipo === "aulas" && r.method === CARTAO && r.parcelas > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Vira {r.parcelas} parcelas a receber: {partes(r.valorNum, r.parcelas).map((v, k) => `${brl(v)} em ${maisMeses(r.paidAt, k + 1)}`).join(" · ")}
                  </p>
                )}
                {r.obs.trim() && <p className="text-xs text-muted-foreground">Obs.: {r.obs.trim()}</p>}
                {r.repetido && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Já existe um pagamento deste aluno com esse valor nesse dia. Confira se não é repetido.
                  </p>
                )}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{brl(r.valorNum)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Total: <strong>{brl(total)}</strong> em {resolvidas.length} lançamento{resolvidas.length !== 1 ? "s" : ""}
            {totalCantina > 0 && <span className="text-muted-foreground"> (aulas {brl(total - totalCantina)} · cantina {brl(totalCantina)})</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRevisando(false)} disabled={pending}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar e editar
            </Button>
            <Button onClick={lancar} disabled={pending}>
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              Confirmar lançamento
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Preenchimento ──────────────────────────────────────────────────────────
  // pb-24: o botão flutuante de ajuda (WhatsApp) não pode cobrir "Revisar e lançar"
  return (
    <div className="space-y-3 pb-24">
      {resolvidas.map((r, i) => {
        const opcoes = abertasPorAluno.get(r.studentId) ?? []
        return (
          <div key={r.key} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold text-muted-foreground">Lançamento {i + 1}</p>
                {/* Aulas = receita de aulas (cobranças/pacotes) · Cantina = separado */}
                <div className="flex overflow-hidden rounded-lg border border-input text-xs">
                  {(["aulas", "cantina"] as const).map((t) => (
                    <button key={t} type="button"
                      onClick={() => atualizar(r.key, { tipo: t, destino: "" })}
                      className={`px-3 py-1 font-medium transition-colors ${r.tipo === t ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                      {t === "aulas" ? "Aulas" : "🍪 Cantina"}
                    </button>
                  ))}
                </div>
              </div>
              {linhas.length > 1 && (
                <button type="button" onClick={() => setLinhas((ls) => ls.filter((l) => l.key !== r.key))}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive" title="Remover linha">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <label className="text-xs font-medium">Aluno *</label>
                <div className="mt-1">
                  <SearchSelect
                    value={r.studentId}
                    onChange={(id) => atualizar(r.key, { studentId: id, destino: "" })}
                    items={itensAluno}
                    placeholder="Buscar aluno pelo nome…"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                <div>
                  <label className="text-xs font-medium">Valor (R$) *</label>
                  <input inputMode="decimal" placeholder="0,00" value={r.valor}
                    onChange={(e) => atualizar(r.key, { valor: e.target.value, destino: "" })}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-medium">{r.tipo === "cantina" ? "Data *" : "Pago em *"}</label>
                  <input type="date" value={r.paidAt} max={hoje}
                    onChange={(e) => atualizar(r.key, { paidAt: e.target.value })}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-medium">Forma de pagamento {r.tipo === "cantina" && r.fiado ? "(no fiado, só ao receber)" : "*"}</label>
                  <select value={r.method} disabled={r.tipo === "cantina" && r.fiado}
                    onChange={(e) => atualizar(r.key, { method: e.target.value })}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Selecionar…</option>
                    {metodos.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {r.tipo === "cantina" && (
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-end">
                <div>
                  <label className="text-xs font-medium">Item da cantina *</label>
                  <input placeholder="Ex.: lanche + suco" value={r.item}
                    onChange={(e) => atualizar(r.key, { item: e.target.value })}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm">
                  <input type="checkbox" checked={r.fiado}
                    onChange={(e) => atualizar(r.key, { fiado: e.target.checked })} />
                  Fiado (paga depois)
                </label>
              </div>
            )}

            {r.tipo === "aulas" && r.studentId && (
              <div>
                <label className="text-xs font-medium">Lançar como</label>
                <select
                  value={r.destinoFinal}
                  onChange={(e) => atualizar(r.key, { destino: e.target.value })}
                  className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {opcoes.map((o) => {
                    const temValor = Number.isFinite(r.valorNum)
                    const maior    = temValor && r.valorNum > o.amount + 0.009
                    const parcial  = temValor && !maior && !igual(o.amount, r.valorNum)
                    return (
                      <option key={o.id} value={o.id} disabled={maior}>
                        Quitar: {o.label} — {brl(o.amount)} · venc. {o.due}{o.vencida ? " (vencida)" : ""}
                        {maior ? " — valor maior que a cobrança" : parcial ? ` — parcial, fica ${brl(o.amount - r.valorNum)} em aberto` : ""}
                      </option>
                    )
                  })}
                  <option value={AVULSO}>Pagamento avulso (sem cobrança)</option>
                </select>
                {opcoes.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Este aluno não tem cobrança em aberto — vai como pagamento avulso.</p>
                )}
                {r.cobranca && r.restante > 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Pagamento parcial: {brl(r.valorNum)} quitado agora e <strong>{brl(r.restante)}</strong> continua em aberto (venc. {r.cobranca.due}).
                  </p>
                )}
              </div>
            )}

            {r.tipo === "aulas" && r.method === CARTAO && (
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start">
                <div>
                  <label className="text-xs font-medium">Parcelas no cartão</label>
                  <select value={r.parcelas} onChange={(e) => atualizar(r.key, { parcelas: Number(e.target.value) })}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Array.from({ length: 12 }, (_, k) => k + 1).map((k) => <option key={k} value={k}>{k === 1 ? "À vista (1x)" : `${k}x`}</option>)}
                  </select>
                </div>
                {r.parcelas > 1 && Number.isFinite(r.valorNum) && r.valorNum > 0 && (
                  <p className="text-[11px] text-muted-foreground md:pt-6">
                    Vira {r.parcelas} parcelas a receber:{" "}
                    {partes(r.valorNum, r.parcelas).map((v, k) => `${brl(v)} em ${maisMeses(r.paidAt, k + 1)}`).join(" · ")}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Observações (opcional)</label>
              <input value={r.obs} maxLength={300} placeholder="Ex.: pagou a mais, ajustar no perfil · combinou desconto…"
                onChange={(e) => atualizar(r.key, { obs: e.target.value })}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {r.repetido && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Já existe um pagamento deste aluno com esse valor nesse dia. Confira se não é repetido.
              </p>
            )}
            {r.problema && (r.studentId || r.valor) && (
              <p className="text-xs text-destructive">{r.problema}</p>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3">
        <Button variant="outline" onClick={adicionar}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar outro recebimento
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm">Total: <strong>{brl(total)}</strong></span>
          <Button onClick={() => setRevisando(true)} disabled={!podeRevisar}>
            Revisar e lançar
          </Button>
        </div>
      </div>
    </div>
  )
}
