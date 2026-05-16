"use client"

import { useState } from "react"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Plus, Trash2, History } from "lucide-react"

interface Teacher { id: string; name: string }
interface Subject { id: string; name: string }

interface PastLesson {
  date:      string
  time:      string
  teacherId: string
  subjectId: string
  duration:  string
  modality:  "PRESENCIAL" | "ONLINE"
  topics:    string
}

function emptyLesson(teachers: Teacher[], subjects: Subject[]): PastLesson {
  return {
    date:      "",
    time:      "08:00",
    teacherId: teachers[0]?.id ?? "",
    subjectId: subjects[0]?.id ?? "",
    duration:  "60",
    modality:  "PRESENCIAL",
    topics:    "",
  }
}

export function PastLessonsInput({
  teachers,
  subjects,
}: {
  teachers: Teacher[]
  subjects: Subject[]
}) {
  const [open,    setOpen]    = useState(false)
  const [lessons, setLessons] = useState<PastLesson[]>([])

  function add()    { setLessons(prev => [...prev, emptyLesson(teachers, subjects)]) }
  function remove(i: number) { setLessons(prev => prev.filter((_, idx) => idx !== i)) }
  function update(i: number, field: keyof PastLesson, val: string) {
    setLessons(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  const valid = lessons.filter(l => l.date && l.teacherId && l.subjectId)

  function toggle() {
    if (!open && lessons.length === 0) add()
    setOpen(v => !v)
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="pastLessons" value={JSON.stringify(valid)} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium font-sub">Aulas já realizadas</span>
          <span className="text-xs text-muted-foreground">(opcional)</span>
          {valid.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {valid.length} aula{valid.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggle}>
          {open ? "Ocultar" : "Adicionar"}
        </Button>
      </div>

      {open && (
        <div className="space-y-3">
          {teachers.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Nenhum professor cadastrado. Cadastre professores antes de registrar aulas realizadas.
            </p>
          )}

          {lessons.map((lesson, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              {/* Data */}
              <div className="space-y-1">
                <Label className="text-xs">Data *</Label>
                <Input
                  type="date"
                  value={lesson.date}
                  onChange={e => update(i, "date", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Horário */}
              <div className="space-y-1">
                <Label className="text-xs">Horário</Label>
                <Input
                  type="time"
                  value={lesson.time}
                  onChange={e => update(i, "time", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Duração */}
              <div className="space-y-1">
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number"
                  value={lesson.duration}
                  min={30} max={240} step={30}
                  onChange={e => update(i, "duration", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Professor */}
              <div className="space-y-1">
                <Label className="text-xs">Professor *</Label>
                <select
                  value={lesson.teacherId}
                  onChange={e => update(i, "teacherId", e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Matéria */}
              <div className="space-y-1">
                <Label className="text-xs">Matéria *</Label>
                <select
                  value={lesson.subjectId}
                  onChange={e => update(i, "subjectId", e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Modalidade */}
              <div className="space-y-1">
                <Label className="text-xs">Modalidade</Label>
                <select
                  value={lesson.modality}
                  onChange={e => update(i, "modality", e.target.value as "PRESENCIAL" | "ONLINE")}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>

              {/* Conteúdo */}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Conteúdo abordado</Label>
                <Input
                  value={lesson.topics}
                  onChange={e => update(i, "topics", e.target.value)}
                  placeholder="Ex: Frações, equações do 1º grau…"
                  className="h-8 text-xs"
                />
              </div>

              {/* Remover */}
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(i)}
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {teachers.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={add}
              className="w-full border-dashed"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Adicionar aula
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
