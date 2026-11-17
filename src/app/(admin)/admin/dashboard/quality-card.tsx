import Link               from "next/link"
import { unstable_cache } from "next/cache"
import { nowBrazil }      from "@/lib/datetime"
import { getQualitySummary } from "@/lib/reports/quality"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

/**
 * A auditoria de qualidade varre o banco inteiro (13 consultas pesadas). Antes
 * ela rodava a cada abertura do painel e segurava a página toda; agora o
 * resultado fica guardado por 10 minutos e o card carrega depois do resto
 * (ver o <Suspense> em page.tsx). A auditoria completa em
 * /admin/relatorios/qualidade continua sempre ao vivo.
 */
const getCachedQualitySummary = unstable_cache(
  async () => getQualitySummary(nowBrazil()),
  ["admin-dashboard-quality-summary"],
  { revalidate: 600, tags: ["quality-summary"] },
)

export async function QualityCard() {
  const qualidade = await getCachedQualitySummary()
  if (qualidade.critical === 0 && qualidade.warning === 0) return null

  return (
    <Link
      href="/admin/relatorios/qualidade"
      className="block overflow-hidden rounded-[10px] border border-border bg-card transition-colors hover:bg-[var(--hover)]"
      style={{ borderLeft: `3px solid ${qualidade.critical > 0 ? "var(--danger)" : "var(--warn)"}` }}
    >
      <div className="flex items-start justify-between gap-3 p-[12px_14px_8px]">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[-0.01em]">Qualidade dos dados</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {qualidade.critical > 0
              ? `${qualidade.critical} problema${qualidade.critical !== 1 ? "s" : ""} crítico${qualidade.critical !== 1 ? "s" : ""}`
              : `${qualidade.warning} ponto${qualidade.warning !== 1 ? "s" : ""} de atenção`}
            {qualidade.atRisk > 0 && ` · ${brl(qualidade.atRisk)} em jogo`}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-medium" style={{ color: "var(--primary)" }}>
          Auditar →
        </span>
      </div>
      <ul className="flex flex-col gap-1 px-[14px] pb-[14px]">
        {qualidade.top.map((t) => (
          <li key={t.title} className="flex items-baseline gap-2 text-[12px] leading-snug">
            <span
              className="shrink-0 font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: t.severity === "critico" ? "var(--danger)" : "var(--warn)" }}
            >
              {t.count}
            </span>
            <span className="text-muted-foreground">
              {t.unit} · {t.title.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  )
}
