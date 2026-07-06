import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  currentPage:  number
  totalPages:   number
  /** Constrói o href de cada página (ex.: p => `?page=${p}`) */
  hrefForPage:  (page: number) => string
}

/**
 * Paginação por links (server-friendly). Mostra setas + uma janela de números
 * ao redor da página atual, com "…" e atalhos para a primeira/última.
 */
export function HistoryPagination({ currentPage, totalPages, hrefForPage }: Props) {
  if (totalPages <= 1) return null

  const win   = 2
  const start = Math.max(1, currentPage - win)
  const end   = Math.min(totalPages, currentPage + win)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)

  const base     = "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg border text-xs font-medium transition-colors"
  const enabled  = "border-border hover:bg-accent"
  const disabled = "border-border/50 text-muted-foreground/40 cursor-not-allowed"

  return (
    <div className="flex items-center justify-center gap-1 pt-4 flex-wrap">
      {currentPage > 1 ? (
        <Link href={hrefForPage(currentPage - 1)} className={`${base} ${enabled}`} aria-label="Página anterior">
          <ChevronLeft className="w-4 h-4" />
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}><ChevronLeft className="w-4 h-4" /></span>
      )}

      {start > 1 && (
        <>
          <Link href={hrefForPage(1)} className={`${base} ${enabled}`}>1</Link>
          {start > 2 && <span className="px-1 text-muted-foreground">…</span>}
        </>
      )}

      {pages.map(p => (
        <Link
          key={p}
          href={hrefForPage(p)}
          className={`${base} ${p === currentPage ? "bg-primary text-white border-primary" : enabled}`}
          aria-current={p === currentPage ? "page" : undefined}
        >
          {p}
        </Link>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link href={hrefForPage(totalPages)} className={`${base} ${enabled}`}>{totalPages}</Link>
        </>
      )}

      {currentPage < totalPages ? (
        <Link href={hrefForPage(currentPage + 1)} className={`${base} ${enabled}`} aria-label="Próxima página">
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}><ChevronRight className="w-4 h-4" /></span>
      )}
    </div>
  )
}
