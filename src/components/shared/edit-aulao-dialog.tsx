"use client"

import { useEffect, useState, useTransition } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { updateAulaoAction } from "@/lib/actions/aulao"
import { toast } from "sonner"
import { Loader2, MapPin, Wifi, Building2, Home, Pencil, AlertTriangle, Repeat2, CalendarCheck } from "lucide-react"
import { mensagemDeErro } from "@/lib/error-message"
import { ouFalhe } from "@/lib/action-result"
import { TeacherSubjectPicker } from "@/components/shared/teacher-subject-picker"

export interface EditTeacherOption {
  id:           string
  name:         string
  teachingMode: "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
  subjects:     { id: string; name: string }[]
}

/** Estado atual do aulão, já convertido para o relógio de Brasília. */
export interface EditAulaoValues {
  id:              string
  lessonType:      "AULAO" | "GROUP"
  title:           string
  teacherId:       string
  subjectId:       string
  date:            string // yyyy-MM-dd
  time:            string // HH:mm
  duration:        number
  modality:        "PRESENCIAL" | "ONLINE"
  teacherOnsite:   boolean
  capacity:        number | null
  isFree:          boolean
  pricePerStudent: number | null
  enrolledCount:   number
  /** Preenchido quando o aulão faz parte de uma série recorrente. */
  recurrenceGroupId?: string | null
  /** Quantas ocorrências pendentes a série ainda tem (incluindo esta). */
  seriesPendingCount?: number
}

interface Props {
  open:      boolean
  onClose:   () => void
  aulao:     EditAulaoValues
  teachers:  EditTeacherOption[]
}

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-primary/30"

export function EditAulaoDialog({ open, onClose, aulao, teachers }: Props) {
  const [title,           setTitle]           = useState(aulao.title)
  const [teacherId,       setTeacherId]       = useState(aulao.teacherId)
  const [subjectId,       setSubjectId]       = useState(aulao.subjectId)
  const [date,            setDate]            = useState(aulao.date)
  const [time,            setTime]            = useState(aulao.time)
  const [duration,        setDuration]        = useState(aulao.duration)
  const [modality,        setModality]        = useState(aulao.modality)
  const [teacherOnsite,   setTeacherOnsite]   = useState(aulao.teacherOnsite)
  const [capacity,        setCapacity]        = useState(aulao.capacity?.toString() ?? "")
  const [isFree,          setIsFree]          = useState(aulao.isFree)
  const [pricePerStudent, setPricePerStudent] = useState(
    aulao.pricePerStudent ? String(aulao.pricePerStudent).replace(".", ",") : ""
  )
  const [scope, setScope] = useState<"ONE" | "SERIES">("ONE")
  const [pending, start] = useTransition()

  const emSerie      = !!aulao.recurrenceGroupId
  const pendentes    = aulao.seriesPendingCount ?? 0
  const aplicaSerie  = emSerie && scope === "SERIES"

  // Reabrir o diálogo mostra o aulão como ele está agora, não como estava na
  // última edição abandonada.
  useEffect(() => {
    if (!open) return
    setTitle(aulao.title)
    setTeacherId(aulao.teacherId)
    setSubjectId(aulao.subjectId)
    setDate(aulao.date)
    setTime(aulao.time)
    setDuration(aulao.duration)
    setModality(aulao.modality)
    setTeacherOnsite(aulao.teacherOnsite)
    setCapacity(aulao.capacity?.toString() ?? "")
    setIsFree(aulao.isFree)
    setPricePerStudent(aulao.pricePerStudent ? String(aulao.pricePerStudent).replace(".", ",") : "")
    setScope("ONE")
  }, [open, aulao])

  const teacher       = teachers.find(t => t.id === teacherId)
  const isOnlineOnly  = teacher?.teachingMode === "ONLINE_ONLY"
  const showLocToggle = modality === "ONLINE" && teacher && !isOnlineOnly
  const capacityNum   = capacity.trim() === "" ? null : parseInt(capacity, 10)

  // O picker já cuida de manter matéria e professor coerentes; aqui só resta a
  // modalidade de quem atende exclusivamente online.
  function handlePickerChange(next: { teacherId: string; subjectId: string }) {
    setTeacherId(next.teacherId)
    setSubjectId(next.subjectId)
    if (teachers.find(t => t.id === next.teacherId)?.teachingMode === "ONLINE_ONLY") {
      setModality("ONLINE")
    }
  }

  function submit() {
    if (!title.trim())            { toast.error("Informe um título para o aulão"); return }
    if (!teacherId || !subjectId) { toast.error("Selecione professor e matéria");  return }

    let price: number | undefined
    if (!isFree) {
      price = parseFloat(pricePerStudent.replace(",", "."))
      if (isNaN(price) || price <= 0) { toast.error("Informe um valor válido por aluno"); return }
    }
    if (capacityNum !== null && (isNaN(capacityNum) || capacityNum < 1)) {
      toast.error("Capacidade inválida"); return
    }
    if (capacityNum !== null && capacityNum < aulao.enrolledCount) {
      toast.error(`Já há ${aulao.enrolledCount} aluno(s) inscrito(s) — a capacidade não pode ser menor`)
      return
    }

    start(async () => {
      try {
        const r = ouFalhe(await updateAulaoAction({
          lessonId:        aulao.id,
          title:           title.trim(),
          teacherId,
          subjectId,
          date,
          time,
          duration,
          modality,
          teacherOnsite:   modality === "ONLINE" ? teacherOnsite : undefined,
          capacity:        capacityNum,
          isFree,
          pricePerStudent: price,
          scope:           aplicaSerie ? "SERIES" : "ONE",
        }))
        toast.success(r.updated > 1
          ? `Série atualizada — ${r.updated} ocorrências remarcadas`
          : "Aulão atualizado")
        onClose()
      } catch (e) {
        toast.error(mensagemDeErro(e, "Erro ao salvar o aulão"))
      }
    })
  }

  const valorMudou = !isFree && aulao.enrolledCount > 0 &&
    (aulao.isFree || parseFloat(pricePerStudent.replace(",", ".")) !== aulao.pricePerStudent)
  const dataMudou  = aulao.enrolledCount > 0 && (date !== aulao.date || time !== aulao.time)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-violet-600" />
            Editar {aulao.lessonType === "AULAO" ? "aulão" : "aula em grupo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alcance da edição — só aparece em aulão recorrente */}
          {emSerie && (
            <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 space-y-2 dark:border-violet-900 dark:bg-violet-950/30">
              <p className="flex items-center gap-1.5 text-xs font-medium text-violet-900 dark:text-violet-200">
                <Repeat2 className="w-3.5 h-3.5" />
                Este aulão se repete. O que você quer alterar?
              </p>
              <div className="flex rounded-lg border border-input overflow-hidden bg-background">
                <button
                  type="button"
                  onClick={() => setScope("ONE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
                    scope === "ONE" ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> Só esta
                </button>
                <button
                  type="button"
                  onClick={() => setScope("SERIES")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
                    scope === "SERIES" ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                  Esta e as próximas{pendentes > 1 ? ` (${pendentes})` : ""}
                </button>
              </div>
              {aplicaSerie && (
                <p className="text-[11px] text-violet-800 dark:text-violet-300">
                  As próximas ocorrências pendentes vão para o horário novo, deslocadas pelos mesmos
                  dias que você mudar aqui. Aulões já realizados ou cancelados ficam como estão.
                </p>
              )}
            </div>
          )}

          {/* Título */}
          <div>
            <label className="text-xs font-medium">
              Título <span className="text-destructive">*</span>
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
          </div>

          {/* Matéria + professor, filtrando um pelo outro */}
          <TeacherSubjectPicker
            teachers={teachers}
            teacherId={teacherId}
            subjectId={subjectId}
            onChange={handlePickerChange}
            selectClassName={`${inputClass} disabled:opacity-50`}
          />

          {/* Data, hora e duração */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Data <span className="text-destructive">*</span></label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium">Horário <span className="text-destructive">*</span></label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium">Duração (min)</label>
              <input
                type="number" min={15} max={480} step={15} value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10) || 90)}
                className={inputClass}
              />
            </div>
          </div>

          {dataMudou && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {aplicaSerie
                ? "As cobranças em aberto de cada ocorrência acompanham a data nova. Avise os alunos — o sistema não reenvia a confirmação sozinho."
                : `As cobranças em aberto dos ${aulao.enrolledCount} aluno(s) inscrito(s) passam para a data nova.
                   Avise os alunos — o sistema não reenvia a confirmação sozinho.`}
            </p>
          )}

          {/* Capacidade */}
          <div>
            <label className="text-xs font-medium">Capacidade máxima (opcional)</label>
            <input
              type="number" min={1} max={200} placeholder="sem limite"
              value={capacity} onChange={e => setCapacity(e.target.value)}
              className={inputClass}
            />
            {aulao.enrolledCount > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {aulao.enrolledCount} aluno(s) já inscrito(s).
              </p>
            )}
          </div>

          {/* Modalidade */}
          <div>
            <label className="text-xs font-medium">Modalidade</label>
            {isOnlineOnly ? (
              <div className="mt-1 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
                <Wifi className="w-3.5 h-3.5" /> Online (professor só atende remotamente)
              </div>
            ) : (
              <div className="mt-1 flex rounded-lg border border-input overflow-hidden">
                <button type="button" onClick={() => setModality("PRESENCIAL")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "PRESENCIAL" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <MapPin className="w-3.5 h-3.5" /> Presencial
                </button>
                <button type="button" onClick={() => setModality("ONLINE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    modality === "ONLINE" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <Wifi className="w-3.5 h-3.5" /> Online
                </button>
              </div>
            )}
          </div>

          {/* Local do professor */}
          {showLocToggle && (
            <div>
              <label className="text-xs font-medium">Local do professor</label>
              <div className="mt-1 flex rounded-lg border border-input overflow-hidden">
                <button type="button" onClick={() => setTeacherOnsite(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    !teacherOnsite ? "bg-muted text-foreground font-medium" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <Home className="w-3.5 h-3.5" /> Em casa
                </button>
                <button type="button" onClick={() => setTeacherOnsite(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                    teacherOnsite ? "bg-amber-100 text-amber-800 font-medium dark:bg-amber-900/50 dark:text-amber-300" : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}>
                  <Building2 className="w-3.5 h-3.5" /> Na sede
                </button>
              </div>
            </div>
          )}

          {/* Gratuito */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-input bg-muted/20">
            <div>
              <p className="text-sm font-medium">Aulão gratuito</p>
              <p className="text-xs text-muted-foreground">Não cobra nenhum valor dos alunos</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFree(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${isFree ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isFree ? "translate-x-4" : ""}`} />
            </button>
          </div>

          {/* Valor por aluno */}
          {!isFree && (
            <div>
              <label className="text-xs font-medium">
                Valor por aluno (R$) <span className="text-destructive">*</span>
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={pricePerStudent} onChange={e => setPricePerStudent(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {isFree && !aulao.isFree && aulao.enrolledCount > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              As cobranças ainda não pagas deste aulão serão removidas. As já pagas permanecem.
            </p>
          )}
          {valorMudou && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              O novo valor vale para as cobranças em aberto. As já pagas não mudam.
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {pending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              : <>Salvar alterações</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
