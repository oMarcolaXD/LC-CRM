"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import { Plus, Loader2, BookOpen, RefreshCw } from "lucide-react"
import { Button }                  from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { toast }  from "sonner"
import { createStudentPackageAction } from "@/lib/actions/financeiro"

interface Props {
  studentId:   string
  studentName: string
  mode:        "novo" | "renovar"
}

export function PackageDialog({ studentId, studentName, mode }: Props) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [totalLessons, setTotal]      = useState("10")
  const [pricePerLesson, setPrice]    = useState("90")
  const [expiresInDays, setExpires]   = useState("")
  const [pending, start]              = useTransition()

  function handleOpen(v: boolean) {
    if (v) {
      setTotal("10")
      setPrice("90")
      setExpires("")
    }
    setOpen(v)
  }

  function submit() {
    const total = parseInt(totalLessons, 10)
    const price = parseFloat(pricePerLesson)
    const expires = expiresInDays ? parseInt(expiresInDays, 10) : undefined

    if (!total || total < 1) { toast.error("Número de aulas inválido"); return }
    if (!price || price < 0)  { toast.error("Valor por aula inválido"); return }

    start(async () => {
      try {
        await createStudentPackageAction({
          studentId,
          totalLessons: total,
          pricePerLesson: price,
          expiresInDays: expires,
        })
        toast.success(mode === "renovar" ? "Pacote renovado com sucesso" : "Pacote criado com sucesso")
        setOpen(false)
        router.push(`/colaborador/alunos/${studentId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar pacote")
      }
    })
  }

  const isRenew = mode === "renovar"

  return (
    <>
      <Button
        size="sm"
        variant={isRenew ? "default" : "outline"}
        className="gap-1.5"
        onClick={() => handleOpen(true)}
      >
        {isRenew
          ? <><RefreshCw className="w-3.5 h-3.5" /> Renovar pacote</>
          : <><Plus className="w-3.5 h-3.5" /> Novo pacote</>
        }
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {isRenew ? "Renovar pacote" : "Novo pacote"} — {studentName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Total de aulas */}
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade de aulas *</Label>
              <Input
                type="number"
                min={1}
                value={totalLessons}
                onChange={e => setTotal(e.target.value)}
                placeholder="10"
                className="h-9"
              />
            </div>

            {/* Preço por aula */}
            <div className="space-y-1.5">
              <Label className="text-xs">Valor por aula (R$) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={pricePerLesson}
                onChange={e => setPrice(e.target.value)}
                placeholder="90.00"
                className="h-9"
              />
            </div>

            {/* Validade */}
            <div className="space-y-1.5">
              <Label className="text-xs">Validade em dias <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                type="number"
                min={1}
                value={expiresInDays}
                onChange={e => setExpires(e.target.value)}
                placeholder="Ex: 180 (deixe vazio para sem validade)"
                className="h-9"
              />
            </div>

            {/* Resumo */}
            {totalLessons && pricePerLesson && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
                <p>
                  <strong className="text-foreground">{totalLessons} aulas</strong>
                  {" × "}
                  <strong className="text-foreground">R$ {Number(pricePerLesson).toFixed(2)}</strong>
                  {" = "}
                  <strong className="text-primary">
                    R$ {(Number(totalLessons) * Number(pricePerLesson)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </strong>
                </p>
                {expiresInDays && (
                  <p>Vence em {expiresInDays} dias a partir de hoje</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {isRenew ? "Renovar" : "Criar pacote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
