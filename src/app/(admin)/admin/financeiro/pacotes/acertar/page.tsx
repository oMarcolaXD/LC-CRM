import Link             from "next/link"
import { PageHeader }   from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { formatBR }     from "@/lib/datetime"
import { planejarAcertoPacotes } from "@/lib/package-refund"
import { AcertarButton } from "./acertar-button"

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ","))
const STATUS: Record<string, string> = { ACTIVE: "ativo", EXHAUSTED: "esgotado", EXPIRED: "vencido" }

/**
 * Confere e corrige pacotes com mais saldo do que aulas ("Usadas" negativo no
 * perfil) — resíduo do bug antigo do cancelamento. Só mostra; grava apenas
 * quando o admin confirma.
 */
export default async function AcertarPacotesPage() {
  const plano = await planejarAcertoPacotes()
  const totalPacotes = plano.reduce((s, a) => s + a.ajustes.length, 0)
  const descartadas  = plano.reduce((s, a) => s + a.descartadas, 0)

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="CORRIGIR SALDOS DE PACOTES"
        description="Pacotes com mais saldo do que aulas (o “Usadas” negativo no perfil do aluno)"
        backHref="/admin/financeiro/pacotes"
      />

      {plano.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum pacote com saldo errado. ✅
        </CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="space-y-1.5 p-4 text-sm">
            <p><strong>{plano.length} aluno(s)</strong> com saldo errado — {totalPacotes} pacote(s) a ajustar.</p>
            <p className="text-muted-foreground">
              Como fica: o pacote que está com saldo acima do total volta para o total, e o excesso
              (aulas canceladas que tinham saído de um pacote anterior) volta para o pacote anterior do aluno,
              até o limite dele. Nada é gravado até você clicar em <strong>Corrigir</strong>.
            </p>
            {descartadas > 0 && (
              <p className="text-amber-600">
                ⚠️ {fmt(descartadas)} aula(s) não cabem em nenhum pacote anterior e vão sair do saldo — confira esses alunos (marcados abaixo) antes de corrigir.
              </p>
            )}
          </CardContent></Card>

          <div className="space-y-3">
            {plano.map((a) => (
              <Card key={a.studentId}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/colaborador/alunos/${a.studentId}`} className="font-semibold hover:underline">{a.nome}</Link>
                    <span className="text-xs text-muted-foreground">R.A. {a.ra}</span>
                  </div>
                  <div className="divide-y rounded-lg border border-border text-sm">
                    {a.ajustes.map((aj) => (
                      <div key={aj.pacoteId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span>
                          Pacote de {fmt(aj.total)} aulas · comprado em {formatBR(aj.compra, "dd/MM/yyyy")} · {STATUS[aj.status] ?? aj.status}
                          {aj.estourado && <span className="ml-1.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">usadas {fmt(aj.total - aj.antes)}</span>}
                        </span>
                        <span className="tabular-nums">
                          restantes <strong>{fmt(aj.antes)}</strong> → <strong className="text-primary">{fmt(aj.depois)}</strong>
                          <span className="ml-1 text-xs text-muted-foreground">(usadas {fmt(aj.total - aj.depois)})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {a.descartadas > 0 && (
                    <p className="text-xs text-amber-600">⚠️ {fmt(a.descartadas)} aula(s) não cabem em nenhum pacote anterior e saem do saldo.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <AcertarButton alunos={plano.length} pacotes={totalPacotes} />
        </>
      )}
    </div>
  )
}
