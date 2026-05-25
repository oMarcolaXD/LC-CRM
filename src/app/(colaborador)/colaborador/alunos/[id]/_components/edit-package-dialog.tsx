"use client"

import { useState, useTransition } from "react"
import { useRouter }  from "next/navigation"
import { toast }      from "sonner"
import { updateStudentPackageAction, deleteStudentPackageAction } from "@/lib/actions/financeiro"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Settings2, Loader2, Trash2, AlertTriangle } from "lucide-react"

interface Props {
  pkg: {
    id:               string
    totalLessons:     number
    pricePerLesson:   number
    remainingLessons: number
    status:           "ACTIVE" | "EXHAUSTED" | "EXPIRED"
    purchaseDate:     string  // "yyyy-MM-dd" pré-formatado
    expiresAt:        string | null  // "yyyy-MM-dd" ou null
  }
  studentId: string
}

export function EditPackageDialog({ pkg, studentId }: Props) {
  const router = useRouter()
  const [open,        setOpen]       = useState(false)
  const [confirmDel,  setConfirmDel] = useState(false)
  const [pending,     start]         = useTransition()

  const [totalLessons,     setTotal]     = useState(String(pkg.totalLessons))
  const [pricePerLesson,   setPrice]     = useState(String(pkg.pricePerLesson))
  const [remainingLessons, setRemaining] = useState(String(pkg.remainingLessons))
  const [status,           setStatus]   = useState(pkg.status)
  const [purchaseDate,     setPurchase]  = useState(pkg.purchaseDate)
  const [expiresAt,        setExpires]   = useState(pkg.expiresAt ?? "")

  function handleOpen(v: boolean) {
    if (v) {
      setTotal(String(pkg.totalLessons))
      setPrice(String(pkg.pricePerLesson))
      setRemaining(String(pkg.remainingLessons))
      setStatus(pkg.status)
      setPurchase(pkg.purchaseDate)
      setExpires(pkg.expiresAt ?? "")
      setConfirmDel(false)
    }
    setOpen(v)
  }

  function submitEdit() {
    const total     = parseFloat(totalLessons)
    const price     = parseFloat(pricePerLesson)
    const remaining = parseFloat(remainingLessons)

    if (!total || total < 0.5 || !Number.isInteger(total * 2)) { toast.error("Qtd. de aulas inválida (use múltiplos de 0,5)"); return }
    if (isNaN(price) || price < 0)                             { toast.error("Valor inválido"); return }
    if (isNaN(remaining) || remaining < 0)                     { toast.error("Aulas restantes inválido"); return }
    if (remaining > total)                                     { toast.error("Restantes não pode ser maior que o total"); return }

    start(async () => {
      try {
        await updateStudentPackageAction({
          packageId:        pkg.id,
          studentId,
          totalLessons:     total,
          pricePerLesson:   price,
          remainingLessons: remaining,
          status,
          purchaseDate,
          expiresAt:        expiresAt || undefined,
        })
        toast.success("Pacote atualizado")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao atualizar pacote")
      }
    })
  }

  function submitDelete() {
    start(async () => {
      try {
        await deleteStudentPackageAction(pkg.id, studentId)
        toast.success("Pacote excluído")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir pacote")
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen(true)}
        className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
        title="Editar pacote"
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-sub flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              Editar Pacote
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Total de aulas</Label>
                <Input
                  type="number" min={0.5} step={0.5}
                  value={totalLessons}
                  onChange={e => setTotal(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Aulas restantes</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={remainingLessons}
                  onChange={e => setRemaining(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Valor por aula (R$)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={pricePerLesson}
                onChange={e => setPrice(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de aquisição</Label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchase(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpires(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue>
                    {status === "ACTIVE" ? "Ativo" : status === "EXHAUSTED" ? "Esgotado" : "Expirado"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="EXHAUSTED">Esgotado</SelectItem>
                  <SelectItem value="EXPIRED">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zona de perigo — excluir */}
            <div className="border-t pt-4 space-y-3">
              {!confirmDel ? (
                <button
                  type="button"
                  onClick={() => setConfirmDel(true)}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir pacote
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-xs">
                      Isso é irreversível. As aulas já registradas <strong>não serão apagadas</strong>, apenas o pacote.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDel(false)}
                      className="flex-1 h-8 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={submitDelete}
                      disabled={pending}
                      className="flex-1 h-8 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {pending ? "Excluindo…" : "Confirmar exclusão"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submitEdit} disabled={pending}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
