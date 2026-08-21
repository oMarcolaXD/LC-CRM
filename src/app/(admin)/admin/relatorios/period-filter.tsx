"use client"

// Filtro de período dos relatórios.
//
// Vive no layout, então não recebe searchParams por prop (layouts do App Router
// não têm acesso a eles) — lê da URL com useSearchParams e escreve de volta com
// router.push. O estado otimista evita o "clique morto" enquanto o RSC recarrega.

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { CalendarRange, Check } from "lucide-react"
import { format, isValid, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PERIODOS, type Periodo } from "@/lib/reports/period"

const QUICK = PERIODOS.filter((p) => p.id !== "personalizado")

function parseParam(v: string | null): Date | undefined {
  if (!v) return undefined
  const d = parseISO(v)
  return isValid(d) ? d : undefined
}

export function PeriodFilter() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic]  = useState<Periodo | null>(null)
  const [open, setOpen]              = useState(false)

  const raw     = searchParams.get("periodo")
  const current = (PERIODOS.some((p) => p.id === raw) ? raw : "mes") as Periodo
  const active  = optimistic ?? current

  const de  = parseParam(searchParams.get("de"))
  const ate = parseParam(searchParams.get("ate"))

  const [range, setRange] = useState<DateRange | undefined>(
    de ? { from: de, to: ate } : undefined,
  )

  function go(params: URLSearchParams) {
    startTransition(() => {
      router.push(params.size ? `${pathname}?${params}` : pathname)
    })
  }

  function pick(id: Periodo) {
    if (id === active && !isPending) return
    setOptimistic(id)
    const params = new URLSearchParams()
    if (id !== "mes") params.set("periodo", id)
    go(params)
  }

  function applyRange() {
    if (!range?.from) return
    const to = range.to ?? range.from
    setOptimistic("personalizado")
    setOpen(false)
    const params = new URLSearchParams()
    params.set("periodo", "personalizado")
    params.set("de",  format(range.from, "yyyy-MM-dd"))
    params.set("ate", format(to,         "yyyy-MM-dd"))
    go(params)
  }

  const customLabel =
    active === "personalizado" && de
      ? `${format(de, "dd/MM/yy")} – ${format(ate ?? de, "dd/MM/yy")}`
      : "Personalizado"

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex items-center gap-[3px] overflow-x-auto rounded-[9px] border border-border bg-card p-[3px]">
        {QUICK.map((p) => {
          const isActive  = active === p.id
          const isLoading = isPending && optimistic === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              disabled={isPending}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] px-[11px] py-[5px] text-[12px] font-medium transition-colors",
                isActive
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:bg-[var(--hover)] hover:text-[var(--text)]",
                isPending && !isActive && "opacity-50",
              )}
              style={isActive ? { background: "var(--primary)" } : undefined}
            >
              {isLoading && <Spinner />}
              {p.label}
            </button>
          )
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={isPending}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-border px-[11px] py-[8px] text-[12px] font-medium outline-none transition-colors",
            active === "personalizado"
              ? "text-white shadow-sm"
              : "bg-card text-muted-foreground hover:bg-[var(--hover)] hover:text-[var(--text)]",
          )}
          style={active === "personalizado" ? { background: "var(--primary)" } : undefined}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {customLabel}
        </PopoverTrigger>

        <PopoverContent align="start" className="w-auto p-3">
          <p className="px-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Escolha o intervalo
          </p>
          <Calendar
            mode="range"
            numberOfMonths={1}
            locale={ptBR}
            selected={range}
            onSelect={setRange}
            defaultMonth={range?.from}
            captionLayout="dropdown"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-[11.5px] text-muted-foreground">
              {range?.from
                ? `${format(range.from, "dd/MM/yyyy")} – ${range.to ? format(range.to, "dd/MM/yyyy") : "…"}`
                : "Nenhuma data selecionada"}
            </span>
            <Button size="sm" onClick={applyRange} disabled={!range?.from}>
              <Check className="mr-1 h-3.5 w-3.5" /> Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
