"use client"

// Alterna entre regime de caixa e vencimento sem perder o período da URL.

import { useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { id: "caixa",      label: "Recebido",   hint: "agrupa pela data do pagamento" },
  { id: "vencimento", label: "Vencimento", hint: "agrupa pela data de vencimento" },
] as const

export function BasisToggle({ current }: { current: "caixa" | "vencimento" }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [isPending, start] = useTransition()

  function pick(id: string) {
    if (id === current) return
    const params = new URLSearchParams(searchParams)
    if (id === "caixa") params.delete("base")
    else                params.set("base", id)
    start(() => router.push(params.size ? `${pathname}?${params}` : pathname))
  }

  return (
    <div className="flex items-center gap-[3px] rounded-[7px] border border-border p-[2px] print:hidden">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.hint}
          onClick={() => pick(o.id)}
          disabled={isPending}
          className={cn(
            "rounded-[5px] px-2 py-[3px] text-[11px] font-medium transition-colors",
            current === o.id
              ? "text-white"
              : "text-muted-foreground hover:text-[var(--text)]",
            isPending && "opacity-60",
          )}
          style={current === o.id ? { background: "var(--primary)" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
