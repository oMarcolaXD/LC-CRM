"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter }   from "next/navigation"
import Link            from "next/link"
import { format }      from "date-fns"
import { toast }       from "sonner"
import {
  Users2, CalendarClock, Wallet, Loader2, X, Search,
  AlertCircle, CheckCircle2, GraduationCap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Badge }  from "@/components/ui/badge"
import { createCourseAction } from "@/lib/actions/course"
import { gerarEncontros, dividirParcelas, descreverGrade, WEEKDAY_LABELS } from "@/lib/course"
import { ouFalhe }        from "@/lib/action-result"
import { mensagemDeErro } from "@/lib/error-message"

interface TeacherOption {
  id:           string
  name:         string
  teachingMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  subjects:     { id: string; name: string }[]
}
interface StudentOption { id: string; name: string; ra: string; grade: string }

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

export function NovaTurmaForm({
  teachers, subjects, students,
}: {
  teachers: TeacherOption[]
  subjects: { id: string; name: string }[]
  students: StudentOption[]
}) {
  const router = useRouter()
  const hoje   = format(new Date(), "yyyy-MM-dd")

  const [name,       setName]       = useState("")
  const [teacherId,  setTeacherId]  = useState("")
  const [subjectId,  setSubjectId]  = useState("")
  const [modality,   setModality]   = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL")
  const [teacherOnsite, setTeacherOnsite] = useState(false)
  const [weekday,    setWeekday]    = useState("6")   // sábado
  const [startTime,  setStartTime]  = useState("10:00")
  const [duration,   setDuration]   = useState("60")
  const [startDate,  setStartDate]  = useState(hoje)
  const [endDate,    setEndDate]    = useState("")
  const [selected,   setSelected]   = useState<string[]>([])
  const [busca,      setBusca]      = useState("")
  const [preco,      setPreco]      = useState("")
  const [parcelas,   setParcelas]   = useState("6")
  const [primeiroVenc, setPrimeiroVenc] = useState("")
  const [pending, start] = useTransition()

  const teacher      = teachers.find(t => t.id === teacherId)
  const isOnlineOnly = teacher?.teachingMode === "ONLINE_ONLY"
  const mostraLocal  = modality === "ONLINE" && teacher && !isOnlineOnly

  const alunosFiltrados = useMemo(() => {
    const q = norm(busca.trim())
    if (!q) return students
    return students.filter(s => norm(s.name).includes(q) || s.ra.includes(q))
  }, [students, busca])

  // Prévia: quantos encontros o período gera e como as parcelas ficam
  const encontros = useMemo(() => {
    if (!startDate || !endDate) return []
    try {
      return gerarEncontros(startDate, endDate, Number(weekday), startTime)
    } catch {
      return []
    }
  }, [startDate, endDate, weekday, startTime])

  const precoNum   = parseFloat(preco.replace(",", ".")) || 0
  const nParcelas  = Math.max(1, parseInt(parcelas) || 1)
  const valores    = precoNum > 0 ? dividirParcelas(precoNum, nParcelas) : []
  const grade      = descreverGrade(Number(weekday), startTime)

  const pronto = name.trim().length >= 3 && teacherId && startDate && endDate && selected.length > 0

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  function submit() {
    if (!pronto || pending) return
    if (endDate < startDate) { toast.error("A data final é anterior à inicial"); return }
    if (encontros.length === 0) {
      toast.error(`Nenhum ${WEEKDAY_LABELS[Number(weekday)]} cai nesse período`)
      return
    }

    start(async () => {
      try {
        const r = ouFalhe(await createCourseAction({
          name:            name.trim(),
          teacherId,
          subjectId:       subjectId || undefined,
          modality,
          teacherOnsite:   modality === "ONLINE" ? teacherOnsite : undefined,
          weekday:         Number(weekday),
          startTime,
          duration:        parseInt(duration) || 60,
          startDate,
          endDate,
          studentIds:      selected,
          pricePerStudent: precoNum > 0 ? precoNum : undefined,
          installments:    nParcelas,
          firstDueDate:    primeiroVenc || undefined,
        }))
        toast.success(
          `Turma criada · ${r.aulas} encontro${r.aulas !== 1 ? "s" : ""}` +
          (r.cobrancas > 0 ? ` · ${r.cobrancas} cobrança${r.cobrancas !== 1 ? "s" : ""}` : ""),
        )
        router.push(`/colaborador/turmas/${r.id}`)
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao criar turma"))
      }
    })
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 space-y-6 lg:space-y-0">
      <div className="space-y-6">

        {/* Identificação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Users2 className="w-4 h-4 text-primary" />
              A turma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da turma *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Acompanhamento Semestral — Sábado"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teacher">Professor *</Label>
                <select
                  id="teacher"
                  value={teacherId}
                  onChange={e => {
                    setTeacherId(e.target.value)
                    setSubjectId("")
                    const t = teachers.find(x => x.id === e.target.value)
                    if (t?.teachingMode === "ONLINE_ONLY") setModality("ONLINE")
                  }}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Matéria</Label>
                <select
                  id="subject"
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sem matéria específica</option>
                  {(teacher?.subjects.length ? teacher.subjects : subjects).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modalidade</Label>
              <div className="flex gap-2">
                {(["PRESENCIAL", "ONLINE"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    disabled={isOnlineOnly && m === "PRESENCIAL"}
                    onClick={() => setModality(m)}
                    className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                      modality === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {m === "PRESENCIAL" ? "Presencial" : "Online"}
                  </button>
                ))}
              </div>
              {mostraLocal && (
                <label className="flex items-center gap-2.5 cursor-pointer w-fit pt-1">
                  <input
                    type="checkbox"
                    checked={teacherOnsite}
                    onChange={e => setTeacherOnsite(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    O professor dá a aula da sede (ocupa uma sala)
                  </span>
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Grade fixa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weekday">Dia da semana</Label>
                <select
                  id="weekday"
                  value={weekday}
                  onChange={e => setWeekday(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {WEEKDAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Horário</Label>
                <Input id="startTime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (min)</Label>
                <Input id="duration" type="number" min={30} step={15} value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Início do período *</Label>
                <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fim do período *</Label>
                <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {startDate && endDate && (
              <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs ${
                encontros.length > 0
                  ? "border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                  : "border border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {encontros.length > 0
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  : <AlertCircle  className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span>
                  {encontros.length > 0 ? (
                    <>
                      Serão criados <strong>{encontros.length} encontros</strong> ({grade}), de{" "}
                      {format(encontros[0], "dd/MM/yyyy")} a {format(encontros[encontros.length - 1], "dd/MM/yyyy")}.
                      O sistema recusa a turma se algum deles bater com a agenda do professor ou lotar as salas.
                    </>
                  ) : (
                    <>Nenhum {WEEKDAY_LABELS[Number(weekday)]} cai entre essas datas.</>
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alunos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              Alunos matriculados
              <span className="text-xs font-normal text-muted-foreground">
                ({selected.length} selecionado{selected.length !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map(id => {
                  const a = students.find(s => s.id === id)
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => toggle(id)}
                    >
                      {a?.name ?? id}
                      <X className="w-3 h-3" />
                    </Badge>
                  )
                })}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nome ou R.A...."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-input divide-y">
              {alunosFiltrados.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum aluno encontrado</p>
              ) : alunosFiltrados.map(s => {
                const on = selected.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                      on ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">{s.ra}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Contrato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Contrato
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preco">Valor por aluno (R$)</Label>
                <Input
                  id="preco" inputMode="decimal" placeholder="0,00"
                  value={preco} onChange={e => setPreco(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parcelas">Parcelas</Label>
                <Input
                  id="parcelas" type="number" min={1} max={24}
                  value={parcelas} onChange={e => setParcelas(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primeiroVenc">1º vencimento</Label>
                <Input
                  id="primeiroVenc" type="date"
                  value={primeiroVenc} onChange={e => setPrimeiroVenc(e.target.value)}
                />
              </div>
            </div>

            {valores.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs space-y-1">
                <p className="font-medium text-foreground">
                  Cada aluno paga {valores.length}x de R$ {valores[valores.length - 1].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  {valores[0] !== valores[valores.length - 1] &&
                    ` (a 1ª sai R$ ${valores[0].toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por causa dos centavos)`}
                </p>
                <p className="text-muted-foreground">
                  {selected.length} aluno{selected.length !== 1 ? "s" : ""} × R$ {precoNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ={" "}
                  <strong className="text-foreground">
                    R$ {(precoNum * selected.length).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </strong>{" "}
                  no total do período. Vencimentos mensais a partir do 1º.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Deixe o valor em branco para uma turma sem cobrança — nenhuma parcela é gerada.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end lg:hidden">
          <Link href="/colaborador/turmas" className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
          <Button onClick={submit} disabled={!pronto || pending}>
            {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users2 className="w-4 h-4 mr-2" />}
            Criar turma
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <aside>
        <div className="lg:sticky lg:top-6 space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className={name.trim() ? "font-medium" : "text-muted-foreground italic"}>
                {name.trim() || "Turma sem nome"}
              </p>
              <p className="text-xs text-muted-foreground">
                {teacher?.name ?? "Sem professor"}
                {subjectId && ` · ${subjects.find(s => s.id === subjectId)?.name}`}
              </p>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p>{grade}</p>
                <p>{encontros.length} encontro{encontros.length !== 1 ? "s" : ""} no período</p>
                <p>{selected.length} aluno{selected.length !== 1 ? "s" : ""} matriculado{selected.length !== 1 ? "s" : ""}</p>
                {precoNum > 0 && (
                  <p>
                    {nParcelas}x de R$ {(precoNum / nParcelas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por aluno
                  </p>
                )}
              </div>

              {pronto && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Pronto para criar
                </div>
              )}
            </CardContent>
          </Card>

          <div className="hidden lg:flex flex-col gap-2">
            <Button onClick={submit} disabled={!pronto || pending} className="w-full">
              {pending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando…</>
                : <><Users2 className="w-4 h-4 mr-2" /> Criar turma</>}
            </Button>
            <Link href="/colaborador/turmas" className={buttonVariants({ variant: "outline" }) + " w-full text-center"}>
              Cancelar
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
