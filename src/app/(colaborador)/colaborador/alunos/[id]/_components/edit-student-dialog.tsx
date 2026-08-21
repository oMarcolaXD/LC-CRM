"use client"

import { useState, useTransition } from "react"
import { useRouter }               from "next/navigation"
import { Pencil, Loader2, GraduationCap, UserRound, Tag, FileText, UserX } from "lucide-react"
import { Button }                  from "@/components/ui/button"
import { buttonVariants }          from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input }       from "@/components/ui/input"
import { Label }       from "@/components/ui/label"
import { PhoneInput }  from "@/components/ui/phone-input"
import { toast }  from "sonner"
import { updateStudentAction } from "@/lib/actions/colaborador"
import { GRADES } from "@/lib/constants/grades"
import { mensagemDeErro } from "@/lib/error-message"

interface Props {
  student: {
    id:     string
    ra:     string
    name:   string
    grade:  string
    school: string | null
    notes:  string | null
    tags:   string[]
    active: boolean
    user: {
      email: string | null
    } | null
  }
  guardian: {
    user: {
      name:  string
      email: string | null
      phone: string | null
    }
  } | null
}

export function EditStudentDialog({ student, guardian }: Props) {
  const router  = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const [name,          setName]          = useState(student.name)
  const [grade,         setGrade]         = useState(student.grade)
  const [school,        setSchool]        = useState(student.school ?? "")
  const [email,         setEmail]         = useState(student.user?.email ?? "")
  const [notes,         setNotes]         = useState(student.notes ?? "")
  const [tags,          setTags]          = useState(student.tags.join(", "))
  const [active,        setActive]        = useState(student.active)
  const [guardianName,  setGuardianName]  = useState(guardian?.user.name  ?? "")
  const [guardianPhone, setGuardianPhone] = useState(guardian?.user.phone ?? "")
  const [guardianEmail, setGuardianEmail] = useState(guardian?.user.email ?? "")

  function handleOpen(v: boolean) {
    if (v) {
      setName(student.name)
      setGrade(student.grade)
      setSchool(student.school ?? "")
      setEmail(student.user?.email ?? "")
      setNotes(student.notes ?? "")
      setTags(student.tags.join(", "))
      setActive(student.active)
      setGuardianName(guardian?.user.name  ?? "")
      setGuardianPhone(guardian?.user.phone ?? "")
      setGuardianEmail(guardian?.user.email ?? "")
    }
    setOpen(v)
  }

  function submit() {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return }
    if (!grade)       { toast.error("Série é obrigatória"); return }

    start(async () => {
      try {
        await updateStudentAction({
          studentId:    student.id,
          name:         name.trim(),
          grade,
          school:       school || undefined,
          email:        email  || undefined,
          notes:        notes  || undefined,
          tags:         tags   || undefined,
          active,
          guardianName:  guardianName  || undefined,
          guardianPhone: guardianPhone || undefined,
          guardianEmail: guardianEmail || undefined,
        })
        toast.success("Dados atualizados com sucesso")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao atualizar dados"))
      }
    })
  }

  return (
    <>
      <button
        onClick={() => handleOpen(true)}
        className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5"}
      >
        <Pencil className="w-4 h-4" />
        Editar
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar — {student.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Dados do aluno */}
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <GraduationCap className="w-3.5 h-3.5" />
                Dados do aluno
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nome do aluno"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">R.A.</Label>
                  <Input
                    value={student.ra}
                    readOnly
                    disabled
                    className="h-9 font-mono tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Série / Ano *</Label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecione</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Escola / Instituição</Label>
                  <Input
                    value={school}
                    onChange={e => setSchool(e.target.value)}
                    placeholder="Ex: Colégio São Paulo"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="aluno@email.com"
                    className="h-9"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                O telefone de contato é o do responsável — o aluno é identificado pelo R.A.
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Etiquetas <span className="text-muted-foreground">(separadas por vírgula)</span></Label>
                <Input
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="Ex: Reforço escolar, Matemática"
                  className="h-9"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Observações internas
              </p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas internas sobre o aluno..."
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Status do aluno */}
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <UserX className="w-3.5 h-3.5" />
                Status do Aluno
              </p>
              <label className="flex items-start gap-3 cursor-pointer group rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={!active}
                  onChange={e => setActive(!e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <div>
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    Ex-aluno (inativo)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Alunos inativos não aparecem na lista padrão, mas mantêm todo o histórico.
                  </p>
                </div>
              </label>
            </div>

            {/* Responsável */}
            {guardian && (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <UserRound className="w-3.5 h-3.5" />
                  Responsável
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Nome do responsável</Label>
                    <Input
                      value={guardianName}
                      onChange={e => setGuardianName(e.target.value)}
                      placeholder="Nome do responsável"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail do responsável</Label>
                    <Input
                      type="email"
                      value={guardianEmail}
                      onChange={e => setGuardianEmail(e.target.value)}
                      placeholder="responsavel@email.com"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">WhatsApp do responsável</Label>
                    <PhoneInput
                      key={`guardian-phone-${open}`}
                      value={guardianPhone}
                      onChange={(raw) => setGuardianPhone(raw)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
