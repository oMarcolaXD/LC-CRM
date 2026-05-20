"use client"

import { useState }      from "react"
import { Button }        from "@/components/ui/button"
import { SubmitButton }  from "@/components/ui/submit-button"
import { Input }      from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label }      from "@/components/ui/label"
import { Textarea }   from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import type { Role, TeacherMode } from "@prisma/client"

const ROLES = [
  { value: "ADMIN",        label: "Administrador" },
  { value: "COLLABORATOR", label: "Colaborador"   },
  { value: "TEACHER",      label: "Professor"     },
  { value: "STUDENT",      label: "Aluno"         },
  { value: "GUARDIAN",     label: "Responsável"   },
]

const GRADES = [
  "6º EF", "7º EF", "8º EF", "9º EF",
  "1º EM", "2º EM", "3º EM",
  "Vestibular", "ENEM", "Concurso", "Superior",
]

const TEACHING_MODES: { value: TeacherMode; label: string; description: string }[] = [
  { value: "PRESENCIAL",   label: "Presencial",          description: "Vem à sede; dá aulas presenciais e pode dar online de uma sala" },
  { value: "ONLINE_ONLY",  label: "Só Online",           description: "Dá aulas apenas online, de casa" },
  { value: "HYBRID",       label: "Presencial e Online", description: "Pode trabalhar de casa (online) e vir à sede" },
]

interface UserFormProps {
  action:   (formData: FormData) => void | Promise<void>
  error?:   string
  defaultValues?: {
    name?: string; email?: string; phone?: string; role?: Role
    grade?: string; school?: string
    hourlyRate?: number; bio?: string; teachingMode?: TeacherMode
    guardianId?: string; relationship?: string
  }
  guardians?: { id: string; name: string }[]
  isEdit?: boolean
}


export function UserForm({ action, error, defaultValues, guardians = [], isEdit }: UserFormProps) {
  const ADULT_GRADES = ["Vestibular", "ENEM", "Concurso", "Superior"]

  const [role, setRole]             = useState<string>(defaultValues?.role ?? "STUDENT")
  const [teachingMode, setTeachingMode] = useState<string>(defaultValues?.teachingMode ?? "HYBRID")
  const [grade, setGrade]           = useState<string>(defaultValues?.grade ?? GRADES[0])
  const [selfGuardian, setSelfGuardian] = useState(false)
  const [hourlyRateDisplay, setHourlyRateDisplay] = useState(
    defaultValues?.hourlyRate != null ? String(defaultValues.hourlyRate).replace(".", ",") : ""
  )

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Dados básicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome completo *</Label>
          <Input id="name" name="name" defaultValue={defaultValues?.name} placeholder="João da Silva" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail <span className="text-muted-foreground font-normal text-xs">(opcional para alunos)</span></Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email} placeholder="joao@email.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone / WhatsApp *</Label>
          <PhoneInput id="phone" name="phone" value={defaultValues?.phone ?? ""} required />
        </div>

        {role !== "STUDENT" && (
          <div className="space-y-2">
            <Label htmlFor="password">{isEdit ? "Nova senha (deixe vazio para manter)" : "Senha *"}</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required={!isEdit} />
          </div>
        )}
        {role === "STUDENT" && !isEdit && (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Uma senha será gerada automaticamente e enviada por e-mail ao aluno (se tiver e-mail cadastrado).
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="role">Perfil *</Label>
          {/* Hidden input para o valor do select */}
          <input type="hidden" name="role" value={role} />
          <Select value={role} onValueChange={(v) => v && setRole(v)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Selecione o perfil">
                {ROLES.find((r) => r.value === role)?.label ?? "Selecione o perfil"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campos de Aluno */}
      {role === "STUDENT" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-xl bg-muted/30">
          <p className="sm:col-span-2 text-sm font-medium text-muted-foreground">Dados do Aluno</p>
          <div className="space-y-2">
            <Label htmlFor="grade">Série / Nível *</Label>
            <input type="hidden" name="grade" value={grade} />
            <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="school">Escola</Label>
            <Input id="school" name="school" defaultValue={defaultValues?.school ?? ""} placeholder="Nome da escola" />
          </div>

          {/* Responsável */}
          {!selfGuardian && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="guardianId">Responsável</Label>
              <input type="hidden" name="guardianId" value={defaultValues?.guardianId ?? ""} id="guardianId-hidden" />
              <Select defaultValue={defaultValues?.guardianId ?? ""}
                onValueChange={(v) => { const el = document.getElementById("guardianId-hidden") as HTMLInputElement | null; if (el) el.value = v ?? "" }}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável (opcional)" /></SelectTrigger>
                <SelectContent>
                  {guardians.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aluno adulto — é o próprio responsável */}
          {ADULT_GRADES.includes(grade) && !isEdit && (
            <div className="sm:col-span-2">
              <input type="hidden" name="selfGuardian" value={selfGuardian ? "on" : ""} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selfGuardian}
                  onChange={(e) => setSelfGuardian(e.target.checked)} />
                <span className="text-sm font-medium">
                  É o próprio responsável (aluno adulto sem tutor)
                </span>
              </label>
              {selfGuardian && (
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Uma conta de responsável será criada automaticamente vinculada a este aluno.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Campos de Responsável */}
      {role === "GUARDIAN" && (
        <div className="p-4 border rounded-xl bg-muted/30 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Dados do Responsável</p>
          <div className="space-y-2">
            <Label htmlFor="relationship">Parentesco / Relação</Label>
            <Input
              id="relationship"
              name="relationship"
              defaultValue={defaultValues?.relationship ?? ""}
              placeholder="Ex: Mãe, Pai, Avó, Responsável, Próprio..."
            />
          </div>
        </div>
      )}

      {/* Campos de Professor */}
      {role === "TEACHER" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-xl bg-muted/30">
          <p className="sm:col-span-2 text-sm font-medium text-muted-foreground">Dados do Professor</p>
          <div className="space-y-2">
            <Label htmlFor="hourlyRate">Valor por Aula *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">R$</span>
              <input type="hidden" name="hourlyRate" value={hourlyRateDisplay.replace(",", ".")} />
              <Input
                id="hourlyRate"
                value={hourlyRateDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d,]/g, "")
                  setHourlyRateDisplay(raw)
                }}
                onBlur={() => {
                  const num = parseFloat(hourlyRateDisplay.replace(",", "."))
                  if (!isNaN(num)) setHourlyRateDisplay(num.toFixed(2).replace(".", ","))
                }}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bio">Bio / Apresentação</Label>
            <Textarea id="bio" name="bio" defaultValue={defaultValues?.bio ?? ""}
              placeholder="Breve apresentação do professor..." rows={3} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Modalidade de Trabalho</Label>
            <input type="hidden" name="teachingMode" value={teachingMode} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TEACHING_MODES.map(({ value, label, description }) => (
                <label key={value}
                  className={`flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-all ${
                    teachingMode === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="_teachingMode" value={value}
                      checked={teachingMode === value}
                      onChange={() => setTeachingMode(value)} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-5">{description}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <SubmitButton className="w-full sm:w-auto">{isEdit ? "Salvar Alterações" : "Criar Usuário"}</SubmitButton>
        <Button type="button" variant="outline" onClick={() => history.back()}>Cancelar</Button>
      </div>
    </form>
  )
}
