"use client"

import { useState, useEffect, useMemo } from "react"
import { SubmitButton }  from "@/components/ui/submit-button"
import { Label }    from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge }    from "@/components/ui/badge"
import { requestLessonAction } from "./actions"
import { DAY_SHORT } from "@/lib/availability"
import { CalendarDays, Clock, Loader2, AlertCircle, ChevronLeft, ChevronRight, Wifi, MapPin, LayoutGrid } from "lucide-react"
import { format, addDays, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"

type TeacherMode = "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"
type EducationLevel = "EF2" | "EM" | "SUPERIOR" | "VESTIBULAR"

interface Teacher {
  id:           string
  name:         string
  avatar?:      string
  bio?:         string
  teachingMode: TeacherMode
  subjects:     { subjectId: string; levels: EducationLevel[] }[]
}

interface Subject { id: string; name: string }

const MODE_LABEL: Record<TeacherMode, string> = {
  ONLINE_ONLY: "Só Online",
  PRESENCIAL:  "Presencial",
  HYBRID:      "Presencial e Online",
}

const MODE_COLOR: Record<TeacherMode, string> = {
  ONLINE_ONLY: "bg-blue-100 text-blue-700 border-blue-200",
  PRESENCIAL:  "bg-green-100 text-green-700 border-green-200",
  HYBRID:      "bg-orange-100 text-orange-700 border-orange-200",
}

const MODE_ICON: Record<TeacherMode, React.ReactNode> = {
  ONLINE_ONLY: <Wifi className="w-3 h-3" />,
  PRESENCIAL:  <MapPin className="w-3 h-3" />,
  HYBRID:      <LayoutGrid className="w-3 h-3" />,
}

function getModalityOptions(mode: TeacherMode) {
  if (mode === "ONLINE_ONLY") return [{ value: "ONLINE",     label: "Online (Meet/Zoom)" }]
  if (mode === "PRESENCIAL")  return [{ value: "PRESENCIAL", label: "Presencial" }, { value: "ONLINE", label: "Online (Meet/Zoom)" }]
  return                               [{ value: "PRESENCIAL", label: "Presencial" }, { value: "ONLINE", label: "Online (Meet/Zoom)" }]
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}


export function BookingForm({
  teachers, subjects, studentLevel, studentId, error,
}: {
  teachers:     Teacher[]
  subjects:     Subject[]
  studentLevel: EducationLevel | null
  studentId:    string
  error?:       string
}) {
  const [subjectId,    setSubjectId]    = useState("")
  const [teacherId,    setTeacherId]    = useState("")
  const [modality,     setModality]     = useState("PRESENCIAL")
  const [notes,        setNotes]        = useState("")

  const [availDates,     setAvailDates]     = useState<string[]>([])
  const [selectedDate,   setSelectedDate]   = useState("")
  const [availSlots,     setAvailSlots]     = useState<string[]>([])
  const [selectedSlot,   setSelectedSlot]   = useState("")
  const [weekOffset,     setWeekOffset]     = useState(0)
  const [loading,        setLoading]        = useState(false)

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === teacherId) ?? null,
    [teachers, teacherId],
  )

  // Filtra professores pela matéria selecionada e nível do aluno
  const filteredTeachers = useMemo(() => {
    if (!subjectId) return []
    return teachers.filter((t) =>
      t.subjects.some(
        (ts) =>
          ts.subjectId === subjectId &&
          (studentLevel === null || ts.levels.includes(studentLevel)),
      ),
    )
  }, [teachers, subjectId, studentLevel])

  // Reset professor ao trocar matéria
  useEffect(() => {
    setTeacherId("")
    setAvailDates([])
    setSelectedDate("")
    setAvailSlots([])
    setSelectedSlot("")
    setWeekOffset(0)
  }, [subjectId])

  // Ajusta modalidade ao selecionar professor
  useEffect(() => {
    if (!selectedTeacher) return
    if (selectedTeacher.teachingMode === "ONLINE_ONLY") setModality("ONLINE")
    else setModality("PRESENCIAL")
  }, [selectedTeacher])

  // Busca datas disponíveis quando professor muda
  useEffect(() => {
    if (!teacherId) { setAvailDates([]); setSelectedDate(""); setAvailSlots([]); setSelectedSlot(""); return }
    setLoading(true)
    fetch(`/api/teachers/${teacherId}/slots`)
      .then((r) => r.json())
      .then((d) => { setAvailDates(d.dates ?? []); setSelectedDate(""); setAvailSlots([]); setSelectedSlot("") })
      .finally(() => setLoading(false))
  }, [teacherId])

  // Busca slots quando data muda
  useEffect(() => {
    if (!teacherId || !selectedDate) { setAvailSlots([]); setSelectedSlot(""); return }
    fetch(`/api/teachers/${teacherId}/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => { setAvailSlots(d.slots ?? []); setSelectedSlot("") })
  }, [teacherId, selectedDate])

  const today     = startOfDay(new Date())
  const weekStart = addDays(today, 1 + weekOffset * 7)
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const preferredAt = selectedDate && selectedSlot ? `${selectedDate}T${selectedSlot}:00` : ""
  const hasAvailability = teacherId && availDates.length > 0
  const noAvailability  = teacherId && !loading && availDates.length === 0

  return (
    <form action={requestLessonAction} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Hidden inputs */}
      <input type="hidden" name="studentId"      value={studentId} />
      <input type="hidden" name="teacherId"      value={teacherId} />
      <input type="hidden" name="subjectId"      value={subjectId} />
      <input type="hidden" name="preferredAt"    value={preferredAt} />
      <input type="hidden" name="modality"       value={modality} />
      <input type="hidden" name="notes"          value={notes} />

      {/* 1. Matéria */}
      <div className="space-y-2">
        <Label>Matéria *</Label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Selecione a matéria</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* 2. Professor — cards */}
      {subjectId && (
        <div className="space-y-3">
          <Label>Professor *</Label>

          {filteredTeachers.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 px-4 py-3 rounded-lg border border-orange-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nenhum professor disponível para esta matéria no seu nível de ensino.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTeachers.map((t) => {
                const isSelected = teacherId === t.id
                return (
                  <button
                    key={t.id} type="button"
                    onClick={() => { setTeacherId(t.id); setWeekOffset(0) }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                        {t.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-primary">{initials(t.name)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight">{t.name}</p>
                        {t.bio && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.bio}</p>
                        )}
                        {t.teachingMode && (
                          <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full border ${MODE_COLOR[t.teachingMode]}`}>
                            {MODE_ICON[t.teachingMode]}
                            {MODE_LABEL[t.teachingMode]}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Calendário de disponibilidade */}
      {teacherId && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Selecione uma data disponível *
          </Label>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando disponibilidade...
            </div>
          )}

          {noAvailability && (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 px-4 py-3 rounded-lg border border-orange-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Este professor ainda não configurou sua disponibilidade. Tente outro professor ou entre em contato.
            </div>
          )}

          {hasAvailability && !loading && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground font-medium">
                  {format(weekDays[0], "dd MMM", { locale: ptBR })} – {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
                </span>
                <button type="button" onClick={() => setWeekOffset((w) => w + 1)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map((day) => {
                  const dateStr  = format(day, "yyyy-MM-dd")
                  const isAvail  = availDates.includes(dateStr)
                  const isSelected = selectedDate === dateStr
                  return (
                    <button
                      key={dateStr} type="button"
                      disabled={!isAvail}
                      onClick={() => { setSelectedDate(dateStr); setSelectedSlot("") }}
                      className={`flex flex-col items-center py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        isSelected
                          ? "bg-primary text-white border-primary shadow-sm"
                          : isAvail
                          ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                          : "text-muted-foreground/40 border-transparent cursor-not-allowed"
                      }`}
                    >
                      <span className="text-[10px] uppercase">{DAY_SHORT[day.getDay()]}</span>
                      <span className="text-base font-bold mt-0.5">{format(day, "d")}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. Horários */}
      {selectedDate && availSlots.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Selecione o horário *
          </Label>
          <div className="flex flex-wrap gap-2">
            {availSlots.map((slot) => (
              <button key={slot} type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  selectedSlot === slot
                    ? "bg-primary text-white border-primary"
                    : "border-border hover:border-primary hover:text-primary"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedDate && availSlots.length === 0 && !loading && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg">
          Não há horários disponíveis nesta data. Escolha outro dia.
        </div>
      )}

      {/* 5. Modalidade — opções dependem do teachingMode do professor */}
      {teacherId && selectedTeacher && (
        <div className="space-y-2">
          <Label>Modalidade *</Label>
          <div className="flex gap-4">
            {getModalityOptions(selectedTeacher.teachingMode).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="_modality" value={value}
                  checked={modality === value}
                  onChange={() => setModality(value)} />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 6. Observações */}
      <div className="space-y-2">
        <Label>Observações (opcional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: tenho dúvida em equações do 2º grau..." rows={2} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButton disabled={!preferredAt || !subjectId || !teacherId} className="w-full sm:w-auto">
          <CalendarDays className="w-4 h-4" />
          Enviar Solicitação
        </SubmitButton>
        {preferredAt && (
          <Badge variant="outline" className="text-xs font-normal">
            {format(new Date(`${selectedDate}T${selectedSlot}:00`), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
          </Badge>
        )}
      </div>
    </form>
  )
}
