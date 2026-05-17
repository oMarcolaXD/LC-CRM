"use client"

import { useState }   from "react"
import { useFormStatus } from "react-dom"
import { Button }     from "@/components/ui/button"
import { Input }      from "@/components/ui/input"
import { Label }      from "@/components/ui/label"
import { Textarea }   from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Loader2 } from "lucide-react"
import type { Role, TeacherMode, EducationLevel } from "@prisma/client"

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

const EDUCATION_LEVELS: { value: EducationLevel; label: string }[] = [
  { value: "EF2",        label: "Fundamental 2 (6º–9º)" },
  { value: "EM",         label: "Ensino Médio" },
  { value: "SUPERIOR",   label: "Superior" },
  { value: "VESTIBULAR", label: "Vestibular / ENEM" },
]

interface UserFormProps {
  action:   (formData: FormData) => void | Promise<void>
  error?:   string
  defaultValues?: {
    name?: string; email?: string; phone?: string; role?: Role
    grade?: string; educationLevel?: EducationLevel; school?: string
    hourlyRate?: number; bio?: string; teachingMode?: TeacherMode
  }
  isEdit?: boolean
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      {label}
    </Button>
  )
}

export function UserForm({ action, error, defaultValues, isEdit }: UserFormProps) {
  const [role, setRole]             = useState<string>(defaultValues?.role ?? "STUDENT")
  const [teachingMode, setTeachingMode] = useState<string>(defaultValues?.teachingMode ?? "HYBRID")
  const [eduLevel, setEduLevel]     = useState<string>(defaultValues?.educationLevel ?? "")

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
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email} placeholder="joao@email.com" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone / WhatsApp</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} placeholder="(11) 99999-9999" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{isEdit ? "Nova senha (deixe vazio para manter)" : "Senha *"}</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required={!isEdit} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Perfil *</Label>
          {/* Hidden input para o valor do select */}
          <input type="hidden" name="role" value={role} />
          <Select value={role} onValueChange={(v) => v && setRole(v)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Selecione o perfil" />
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
            <input type="hidden" name="grade" value={defaultValues?.grade ?? GRADES[0]} id="grade-hidden" />
            <Select defaultValue={defaultValues?.grade ?? GRADES[0]}
              onValueChange={(v) => { if (!v) return; const el = document.getElementById("grade-hidden") as HTMLInputElement | null; if (el) el.value = v }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="school">Escola</Label>
            <Input id="school" name="school" defaultValue={defaultValues?.school ?? ""} placeholder="Nome da escola" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Nível de Ensino (para filtro de agendamento)</Label>
            <input type="hidden" name="educationLevel" value={eduLevel} />
            <div className="flex flex-wrap gap-3">
              {EDUCATION_LEVELS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="_educationLevel" value={value}
                    checked={eduLevel === value}
                    onChange={() => setEduLevel(value)} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Campos de Professor */}
      {role === "TEACHER" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-xl bg-muted/30">
          <p className="sm:col-span-2 text-sm font-medium text-muted-foreground">Dados do Professor</p>
          <div className="space-y-2">
            <Label htmlFor="hourlyRate">Valor por Aula (R$) *</Label>
            <Input id="hourlyRate" name="hourlyRate" type="number" min="0" step="0.01"
              defaultValue={defaultValues?.hourlyRate ?? ""} placeholder="80.00" />
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
        <SubmitButton label={isEdit ? "Salvar Alterações" : "Criar Usuário"} />
        <Button type="button" variant="outline" onClick={() => history.back()}>Cancelar</Button>
      </div>
    </form>
  )
}
