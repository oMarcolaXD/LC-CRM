"use client"

import { useState, useTransition } from "react"
import { Button }  from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { updateTeacherSubjectsAction } from "@/lib/actions/teacher"

type EducationLevel = "EF2" | "EM" | "SUPERIOR" | "VESTIBULAR"

const LEVELS: { value: EducationLevel; label: string }[] = [
  { value: "EF2",        label: "Fund. 2 (6º–9º)" },
  { value: "EM",         label: "Ensino Médio" },
  { value: "SUPERIOR",   label: "Superior" },
  { value: "VESTIBULAR", label: "Vestibular" },
]

interface SubjectRow {
  subjectId:   string
  subjectName: string
  levels:      EducationLevel[]
}

export function TeacherSubjectsForm({
  teacherId,
  allSubjects,
  currentSubjects,
}: {
  teacherId:       string
  allSubjects:     { id: string; name: string }[]
  currentSubjects: { subjectId: string; levels: EducationLevel[] }[]
}) {
  const [rows, setRows] = useState<SubjectRow[]>(
    allSubjects.map((s) => {
      const cur = currentSubjects.find((c) => c.subjectId === s.id)
      return { subjectId: s.id, subjectName: s.name, levels: cur?.levels ?? [] }
    }),
  )
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function toggleLevel(subjectId: string, level: EducationLevel) {
    setRows((prev) =>
      prev.map((r) =>
        r.subjectId !== subjectId ? r : {
          ...r,
          levels: r.levels.includes(level)
            ? r.levels.filter((l) => l !== level)
            : [...r.levels, level],
        },
      ),
    )
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await updateTeacherSubjectsAction(
        teacherId,
        rows.map((r) => ({ subjectId: r.subjectId, levels: r.levels })),
      )
      setSaved(true)
    })
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Matéria</th>
              {LEVELS.map((l) => (
                <th key={l.value} className="text-center py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.subjectId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="py-3 pr-4 font-medium">{row.subjectName}</td>
                {LEVELS.map((l) => (
                  <td key={l.value} className="text-center py-3 px-3">
                    <input
                      type="checkbox"
                      checked={row.levels.includes(l.value)}
                      onChange={() => toggleLevel(row.subjectId, l.value)}
                      className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Matérias
        </Button>
        {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
      </div>
    </div>
  )
}
