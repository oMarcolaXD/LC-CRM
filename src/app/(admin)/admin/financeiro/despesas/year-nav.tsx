import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

/** Navegação de ano — mesmo padrão de /admin/metas. */
export function YearNav({ year }: { year: number }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/admin/financeiro/despesas?ano=${year - 1}`}
        className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-card text-muted-foreground transition-colors hover:bg-[var(--hover)]"
        aria-label="Ano anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-[60px] text-center text-[15px] font-semibold">{year}</span>
      <Link
        href={`/admin/financeiro/despesas?ano=${year + 1}`}
        className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-card text-muted-foreground transition-colors hover:bg-[var(--hover)]"
        aria-label="Próximo ano"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
