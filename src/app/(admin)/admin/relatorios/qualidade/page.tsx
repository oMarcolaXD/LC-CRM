import Link from "next/link"
import { nowBrazil } from "@/lib/datetime"
import { brl, brlRound, num } from "@/lib/reports/format"
import { getQualityReport, type QualityCheck, type Severity } from "@/lib/reports/quality"
import { Panel, StatGrid, Stat, Note } from "../ui"
import { cn } from "@/lib/utils"
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

const SEV = {
  critico: {
    label: "Crítico",
    icon:  AlertTriangle,
    color: "var(--danger)",
    soft:  "var(--danger-soft)",
  },
  atencao: {
    label: "Atenção",
    icon:  AlertCircle,
    color: "var(--warn)",
    soft:  "var(--warn-soft)",
  },
  info: {
    label: "Revisar",
    icon:  Info,
    color: "var(--info)",
    soft:  "var(--info-soft)",
  },
} satisfies Record<Severity, { label: string; icon: typeof Info; color: string; soft: string }>

export default async function QualidadePage() {
  const now    = nowBrazil()
  const report = await getQualityReport(now)

  const problemas = report.checks.filter((c) => c.count > 0)
  const limpos    = report.checks.filter((c) => c.count === 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground">
        Esta aba varre a <strong className="font-medium text-[var(--text)]">base inteira</strong> —
        o filtro de período acima não se aplica. Um pacote sem cobrança de março continua sendo
        um problema em agosto.
      </p>

      <StatGrid cols={4}>
        <Stat
          label="Problemas críticos"
          value={num(report.critical)}
          sub="custam dinheiro agora"
          tone={report.critical > 0 ? "negative" : "positive"}
        />
        <Stat
          label="Pontos de atenção"
          value={num(report.warning)}
          sub="distorcem os números do relatório"
        />
        <Stat
          label="Valor envolvido"
          value={brlRound(report.atRisk)}
          sub="soma do que está em jogo nas inconsistências"
          tone={report.atRisk > 0 ? "negative" : undefined}
        />
        <Stat
          label="Verificações limpas"
          value={`${report.clean}/${report.checks.length}`}
          sub="nada a corrigir nessas"
          tone={report.clean === report.checks.length ? "positive" : undefined}
        />
      </StatGrid>

      {problemas.length === 0 ? (
        <Panel title="Nada a corrigir" subtitle="Todas as verificações passaram">
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8" style={{ color: "var(--success)" }} />
            <p className="text-[13px] font-medium">A base está consistente</p>
            <p className="max-w-md text-[11.5px] text-muted-foreground">
              Nenhuma aula sem receita, cobrança duplicada, pacote solto ou conflito de agenda.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {problemas.map((c) => <CheckCard key={c.id} check={c} />)}
        </div>
      )}

      {limpos.length > 0 && (
        <Panel
          title="Verificações sem problema"
          subtitle={`${limpos.length} de ${report.checks.length} passaram limpas`}
        >
          <ul className="flex flex-col gap-1.5">
            {limpos.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
                <CheckCircle2 className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: "var(--success)" }} />
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="ml-1.5 text-muted-foreground">— {c.ok}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Note>
        As verificações rodam direto no banco, sempre sobre o estado atual. Depois de corrigir
        algo, é só recarregar a página — não há cache aqui.
      </Note>
    </div>
  )
}

function CheckCard({ check: c }: { check: QualityCheck }) {
  const sev  = SEV[c.severity]
  const Icon = sev.icon
  const unit = c.count === 1 ? c.unit[0] : c.unit[1]

  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card print:break-inside-avoid">
      <header
        className="flex flex-wrap items-start justify-between gap-3 px-[14px] py-3"
        style={{ background: sev.soft, borderLeft: `3px solid ${sev.color}` }}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className="mt-px h-4 w-4 shrink-0" style={{ color: sev.color }} />
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{c.title}</h2>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-snug text-muted-foreground">
              {c.why}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className="font-mono text-[19px] font-semibold leading-none"
            style={{ color: sev.color, fontFeatureSettings: '"tnum"' }}
          >
            {num(c.count)}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">{unit}</p>
          {c.amount != null && c.amount > 0 && (
            <p
              className="mt-1 font-mono text-[12px] font-semibold"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {brl(c.amount)}
            </p>
          )}
        </div>
      </header>

      {c.items.length > 0 && (
        <ul className="divide-y divide-border">
          {c.items.map((item, i) => (
            <li key={i} className="flex items-center gap-3 px-[14px] py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium">{item.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{item.detail}</p>
              </div>
              {item.amount != null && item.amount > 0 && (
                <span
                  className="shrink-0 font-mono text-[12px] text-muted-foreground"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {brl(item.amount)}
                </span>
              )}
              {item.href && (
                <Link
                  href={item.href}
                  className={cn(
                    "shrink-0 whitespace-nowrap text-[11px] font-medium transition-opacity hover:opacity-70",
                    "print:hidden",
                  )}
                  style={{ color: sev.color }}
                >
                  Resolver <ArrowRight className="ml-0.5 inline h-3 w-3" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {c.count > c.items.length && (
        <p className="border-t border-border px-[14px] py-2 text-[11px] text-muted-foreground">
          e mais {num(c.count - c.items.length)} — a lista mostra os primeiros para caber na tela
        </p>
      )}
    </section>
  )
}
