"use client"

import { useState }      from "react"
import { Button }        from "@/components/ui/button"
import { SubmitButton }  from "@/components/ui/submit-button"
import { Input }         from "@/components/ui/input"
import { PhoneInput }    from "@/components/ui/phone-input"
import { Label }         from "@/components/ui/label"
import { Textarea }      from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertCircle, GraduationCap, BookOpen, Users,
  Briefcase, ShieldCheck, User, School, UserPlus, Link2, UserX, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role, TeacherMode } from "@prisma/client"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES = [
  {
    value: "STUDENT",      label: "Aluno",
    icon:  GraduationCap,
    description: "Cadastro de aluno da Lição de Casa",
    color: "text-[#FB8500]", activeBg: "bg-[#FB8500]/10", activeBorder: "border-[#FB8500]",
  },
  {
    value: "TEACHER",      label: "Professor",
    icon:  BookOpen,
    description: "Docente que ministra as aulas",
    color: "text-[#219EBC]", activeBg: "bg-[#219EBC]/10", activeBorder: "border-[#219EBC]",
  },
  {
    value: "GUARDIAN",     label: "Responsável",
    icon:  Users,
    description: "Pai, mãe ou tutor de um aluno",
    color: "text-purple-500", activeBg: "bg-purple-500/10", activeBorder: "border-purple-500",
  },
  {
    value: "COLLABORATOR", label: "Colaborador",
    icon:  Briefcase,
    description: "Equipe interna da empresa",
    color: "text-emerald-500", activeBg: "bg-emerald-500/10", activeBorder: "border-emerald-500",
  },
  {
    value: "ADMIN",        label: "Administrador",
    icon:  ShieldCheck,
    description: "Acesso total ao sistema",
    color: "text-rose-500", activeBg: "bg-rose-500/10", activeBorder: "border-rose-500",
  },
]

const GRADE_GROUPS = [
  { label: "Ensino Fundamental", grades: ["6º EF", "7º EF", "8º EF", "9º EF"] },
  { label: "Ensino Médio",       grades: ["1º EM", "2º EM", "3º EM"]           },
  { label: "Superior & Outros",  grades: ["Vestibular", "ENEM", "Concurso", "Superior"] },
]

const ADULT_GRADES  = new Set(["Vestibular", "ENEM", "Concurso", "Superior"])
const DEFAULT_GRADE = "6º EF"

const TEACHING_MODES: { value: TeacherMode; label: string; description: string }[] = [
  { value: "PRESENCIAL",  label: "Presencial",          description: "Vem à sede; aulas presenciais e pode dar online de uma sala" },
  { value: "ONLINE_ONLY", label: "Só Online",           description: "Dá aulas apenas online, de casa" },
  { value: "HYBRID",      label: "Presencial e Online", description: "Pode trabalhar de casa ou vir à sede" },
]

type GuardianMode = "new" | "existing" | "self" | "none"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-border">
      <div className="rounded-lg bg-muted p-2 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-sub font-semibold text-sm tracking-wide">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {children}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserFormProps {
  action:         (formData: FormData) => void | Promise<void>
  error?:         string
  canCreateAdmin?: boolean
  defaultValues?: {
    name?: string; email?: string; phone?: string; role?: Role
    grade?: string; school?: string
    hourlyRate?: number; bio?: string; teachingMode?: TeacherMode
    guardianId?: string; relationship?: string
  }
  guardians?: { id: string; name: string }[]
  students?:  { id: string; name: string; grade: string; linked?: boolean }[]
  isEdit?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserForm({
  action, error, canCreateAdmin = true,
  defaultValues, guardians = [], students = [], isEdit,
}: UserFormProps) {
  const ROLES = canCreateAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r.value !== "ADMIN")

  const [role,         setRole]         = useState<string>(defaultValues?.role ?? "STUDENT")
  const [grade,        setGrade]        = useState<string>(defaultValues?.grade ?? DEFAULT_GRADE)
  const [teachingMode, setTeachingMode] = useState<string>(defaultValues?.teachingMode ?? "HYBRID")
  const [guardianId,   setGuardianId]   = useState<string>(defaultValues?.guardianId ?? "")
  const [guardianMode, setGuardianMode] = useState<GuardianMode>("new")
  const [studentSearch,       setStudentSearch]       = useState("")
  const [selectedStudentIds,  setSelectedStudentIds]  = useState<Set<string>>(
    new Set(students.filter((s) => s.linked).map((s) => s.id))
  )

  const [hourlyRateDisplay, setHourlyRateDisplay] = useState(
    defaultValues?.hourlyRate != null ? String(defaultValues.hourlyRate).replace(".", ",") : ""
  )

  const activeRoleCfg = ROLES.find((r) => r.value === role) ?? ROLES[0]
  const isAdult       = ADULT_GRADES.has(grade)

  // When switching to adult grade, default to "self" if not editing
  function handleGradeChange(g: string) {
    setGrade(g)
    if (!isEdit) {
      if (ADULT_GRADES.has(g) && guardianMode === "none") setGuardianMode("self")
      if (!ADULT_GRADES.has(g) && guardianMode === "self") setGuardianMode("new")
    }
  }

  const GUARDIAN_MODES: { value: GuardianMode; label: string; icon: React.ElementType; description: string }[] = [
    {
      value: "new",      label: "Criar responsável",  icon: UserPlus,
      description: "Cadastrar um responsável novo agora",
    },
    {
      value: "existing", label: "Vincular existente", icon: Link2,
      description: "Selecionar um responsável já cadastrado",
    },
    ...(isAdult && !isEdit ? [{
      value: "self" as GuardianMode, label: "Aluno adulto",  icon: User,
      description: "Aluno é o próprio responsável",
    }] : []),
    {
      value: "none",     label: "Sem responsável",    icon: UserX,
      description: "Não vincular responsável agora",
    },
  ]

  return (
    <form action={action} className="space-y-5 max-w-2xl">

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* ── 1. Tipo de perfil ────────────────────────────────────────── */}
      {!isEdit && (
        <Section>
          <SectionHeader icon={ShieldCheck} title="Tipo de perfil" description="Define as permissões e os dados deste usuário" />
          <input type="hidden" name="role" value={role} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ROLES.map(({ value, label, icon: Icon, description, color, activeBg, activeBorder }) => {
              const active = role === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    active
                      ? `${activeBg} ${activeBorder} shadow-sm`
                      : "border-border bg-background hover:bg-muted/40 hover:border-muted-foreground/30",
                  )}
                >
                  <div className={cn("rounded-lg p-2", active ? activeBg : "bg-muted")}>
                    <Icon className={cn("w-4 h-4", active ? color : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold leading-tight", active ? color : "text-foreground")}>
                      {label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {isEdit && <input type="hidden" name="role" value={role} />}

      {/* ── 2. Informações básicas ───────────────────────────────────── */}
      <Section>
        <SectionHeader icon={User} title="Informações básicas" />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo *</Label>
            <Input id="name" name="name" defaultValue={defaultValues?.name} placeholder="Ex: João da Silva" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">
                E-mail
                {role === "STUDENT" && (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(opcional)</span>
                )}
              </Label>
              <Input id="email" name="email" type="email" defaultValue={defaultValues?.email} placeholder="joao@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone / WhatsApp *</Label>
              <PhoneInput id="phone" name="phone" value={defaultValues?.phone ?? ""} required />
            </div>
          </div>

          {role === "STUDENT" && !isEdit ? (
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#219EBC]" />
              Uma senha será gerada automaticamente e enviada por e-mail ao aluno (se tiver e-mail cadastrado).
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="password">{isEdit ? "Nova senha" : "Senha *"}</Label>
              <Input
                id="password" name="password" type="password"
                placeholder={isEdit ? "Deixe vazio para manter a atual" : "••••••••"}
                required={!isEdit && role !== "STUDENT"}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── 3a. Aluno ────────────────────────────────────────────────── */}
      {role === "STUDENT" && (
        <Section>
          <SectionHeader
            icon={GraduationCap}
            title="Perfil do Aluno"
            description="Série, escola e responsável"
          />
          <input type="hidden" name="grade" value={grade} />

          {/* Grade chips */}
          <div>
            <Label className="mb-3 block">Série / Nível *</Label>
            <div className="space-y-3">
              {GRADE_GROUPS.map(({ label, grades }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grades.map((g) => {
                      const active = grade === g
                      return (
                        <button
                          key={g} type="button"
                          onClick={() => handleGradeChange(g)}
                          className={cn(
                            "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all",
                            active
                              ? "border-[#FB8500] bg-[#FB8500]/10 text-[#FB8500] shadow-sm"
                              : "border-border bg-background text-foreground hover:border-[#FB8500]/40 hover:bg-[#FB8500]/5",
                          )}
                        >
                          {g}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Escola */}
          <div className="space-y-1.5">
            <Label htmlFor="school" className="flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-muted-foreground" />
              Escola
              <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="school" name="school" defaultValue={defaultValues?.school ?? ""} placeholder="Nome da escola" />
          </div>

          {/* ── Responsável ── */}
          {!isEdit && (
            <div className="space-y-3">
              <Label>Responsável</Label>
              <input type="hidden" name="guardianMode" value={guardianMode} />

              {/* Mode selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GUARDIAN_MODES.map(({ value, label, icon: Icon, description }) => {
                  const active = guardianMode === value
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => setGuardianMode(value)}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all text-xs",
                        active
                          ? "border-[#FB8500] bg-[#FB8500]/5 shadow-sm"
                          : "border-border bg-background hover:border-[#FB8500]/30 hover:bg-muted/30",
                      )}
                    >
                      <Icon className={cn("w-4 h-4", active ? "text-[#FB8500]" : "text-muted-foreground")} />
                      <span className={cn("font-semibold leading-tight", active ? "text-[#FB8500]" : "text-foreground")}>
                        {label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-snug">{description}</span>
                    </button>
                  )
                })}
              </div>

              {/* Mode content */}
              {guardianMode === "new" && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados do novo responsável</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="newGuardian_name">Nome completo *</Label>
                    <Input id="newGuardian_name" name="newGuardian_name" placeholder="Ex: Maria da Silva" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="newGuardian_phone">Telefone / WhatsApp *</Label>
                      <PhoneInput id="newGuardian_phone" name="newGuardian_phone" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newGuardian_email">
                        E-mail
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(opcional)</span>
                      </Label>
                      <Input id="newGuardian_email" name="newGuardian_email" type="email" placeholder="responsavel@email.com" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newGuardian_relationship">
                      Parentesco
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input id="newGuardian_relationship" name="newGuardian_relationship" placeholder="Ex: Mãe, Pai, Avó…" />
                  </div>
                </div>
              )}

              {guardianMode === "existing" && (
                <div>
                  <input type="hidden" name="guardianId" value={guardianId} />
                  <Select
                    value={guardianId || "__none__"}
                    onValueChange={(v) => setGuardianId(v === "__none__" ? "" : (v ?? ""))}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {guardianId
                          ? (guardians.find((g) => g.id === guardianId)?.name ?? "Responsável selecionado")
                          : "Selecionar…"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecionar…</SelectItem>
                      {guardians.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {guardianMode === "self" && (
                <div className="flex items-start gap-2.5 rounded-lg bg-[#FB8500]/5 border border-[#FB8500]/20 px-4 py-3 text-xs text-muted-foreground">
                  <User className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#FB8500]" />
                  Uma conta de responsável será criada automaticamente vinculada a este aluno.
                </div>
              )}

              {guardianMode === "none" && (
                <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                  <UserX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Nenhum responsável vinculado. Pode ser adicionado depois na edição do aluno.
                </div>
              )}
            </div>
          )}

          {/* Edit mode: existing guardian select */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <input type="hidden" name="guardianMode" value="existing" />
              <input type="hidden" name="guardianId" value={guardianId} />
              <Select
                value={guardianId || "__none__"}
                onValueChange={(v) => setGuardianId(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {guardianId
                      ? (guardians.find((g) => g.id === guardianId)?.name ?? "Responsável selecionado")
                      : "Nenhum"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {guardians.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Section>
      )}

      {/* ── 3b. Professor ────────────────────────────────────────────── */}
      {role === "TEACHER" && (
        <Section>
          <SectionHeader
            icon={BookOpen}
            title="Dados do Professor"
            description="Valor por aula, modalidade e apresentação"
          />
          <div className="space-y-4">
            <div className="space-y-1.5 max-w-[180px]">
              <Label htmlFor="hourlyRate">Valor por aula *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">R$</span>
                <input type="hidden" name="hourlyRate" value={hourlyRateDisplay.replace(",", ".")} />
                <Input
                  id="hourlyRate"
                  value={hourlyRateDisplay}
                  onChange={(e) => setHourlyRateDisplay(e.target.value.replace(/[^\d,]/g, ""))}
                  onBlur={() => {
                    const num = parseFloat(hourlyRateDisplay.replace(",", "."))
                    if (!isNaN(num)) setHourlyRateDisplay(num.toFixed(2).replace(".", ","))
                  }}
                  placeholder="0,00"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Modalidade de trabalho</Label>
              <input type="hidden" name="teachingMode" value={teachingMode} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEACHING_MODES.map(({ value, label, description }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex flex-col gap-1.5 p-4 rounded-xl border cursor-pointer transition-all",
                      teachingMode === value
                        ? "border-[#219EBC] bg-[#219EBC]/5"
                        : "border-border hover:border-[#219EBC]/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio" name="_teachingMode" value={value}
                        checked={teachingMode === value}
                        onChange={() => setTeachingMode(value)}
                      />
                      <span className={cn("text-sm font-semibold", teachingMode === value && "text-[#219EBC]")}>
                        {label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-5 leading-snug">{description}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio / Apresentação</Label>
              <Textarea
                id="bio" name="bio" defaultValue={defaultValues?.bio ?? ""}
                placeholder="Breve apresentação do professor..."
                rows={3}
              />
            </div>
          </div>
        </Section>
      )}

      {/* ── 3c. Responsável ──────────────────────────────────────────── */}
      {role === "GUARDIAN" && (
        <Section>
          <SectionHeader
            icon={Users}
            title="Dados do Responsável"
            description="Parentesco com o(s) aluno(s) que representa"
          />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="relationship">Parentesco / Relação</Label>
              <Input
                id="relationship" name="relationship"
                defaultValue={defaultValues?.relationship ?? ""}
                placeholder="Ex: Mãe, Pai, Avó, Próprio…"
              />
            </div>

            {/* Vinculação de alunos */}
            {students.length > 0 && (() => {
              const filtered = students.filter((s) =>
                s.name.toLowerCase().includes(studentSearch.toLowerCase())
              )
              return (
                <div className="space-y-2">
                  <Label>Vincular alunos</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione quais alunos este responsável representa
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Buscar aluno..."
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Nenhum aluno encontrado
                      </p>
                    ) : (
                      filtered.map((student) => {
                        const checked = selectedStudentIds.has(student.id)
                        return (
                          <label
                            key={student.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors select-none",
                              checked ? "bg-[#FB8500]/5" : "hover:bg-muted/40",
                            )}
                          >
                            <input
                              type="checkbox"
                              name="studentIds"
                              value={student.id}
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedStudentIds)
                                if (e.target.checked) { next.add(student.id) } else { next.delete(student.id) }
                                setSelectedStudentIds(next)
                              }}
                              className="accent-[#FB8500] w-4 h-4 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.grade}</p>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                  {selectedStudentIds.size > 0 && (
                    <p className="text-xs text-[#FB8500] font-medium">
                      {selectedStudentIds.size} aluno{selectedStudentIds.size !== 1 ? "s" : ""} selecionado{selectedStudentIds.size !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        </Section>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        <SubmitButton className="px-8">
          {isEdit ? "Salvar alterações" : `Criar ${activeRoleCfg.label}`}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>

    </form>
  )
}
