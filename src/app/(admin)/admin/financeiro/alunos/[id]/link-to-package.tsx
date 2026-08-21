"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Link2, Loader2, X } from "lucide-react"
import { linkPaymentToPackageAction } from "@/lib/actions/financeiro"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { mensagemDeErro } from "@/lib/error-message"

interface PackageOption {
  id: string
  totalLessons: number
  purchaseDate: Date
  status: string
}

interface Props {
  paymentId: string
  studentId: string
  packages: PackageOption[]
  hasGroup: boolean
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo", EXHAUSTED: "Esgotado", EXPIRED: "Expirado",
}

function fmtLessons(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")
}

export function LinkToPackage({ paymentId, studentId, packages, hasGroup }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function link(packageId: string) {
    start(async () => {
      try {
        await linkPaymentToPackageAction(paymentId, packageId, studentId)
        toast.success(hasGroup ? "Parcelas vinculadas ao pacote" : "Cobrança vinculada ao pacote")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao vincular"))
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Vincular ao pacote"
        className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-secondary hover:border-secondary transition-colors"
      >
        <Link2 className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <select
        autoFocus
        disabled={pending}
        onChange={(e) => e.target.value && link(e.target.value)}
        className="h-7 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring max-w-[180px]"
        defaultValue=""
      >
        <option value="" disabled>
          {hasGroup ? "Vincular parcelas a…" : "Vincular a…"}
        </option>
        {packages.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {fmtLessons(pkg.totalLessons)} aulas · {format(pkg.purchaseDate, "dd/MM/yy", { locale: ptBR })} · {STATUS_LABEL[pkg.status] ?? pkg.status}
          </option>
        ))}
      </select>
      {pending
        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
        : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )
      }
    </div>
  )
}
