"use client"

/**
 * Par matéria + professor com filtragem nos dois sentidos.
 *
 * A matéria vem primeiro de propósito: quem atende quase sempre sabe o que o
 * aluno precisa ("preciso de química") e não de cor quem leciona aquilo —
 * escolhida a matéria, a lista de professores já vem reduzida a quem dá aula
 * dela. O caminho inverso continua valendo: escolher o professor primeiro
 * restringe as matérias às dele.
 */

import { useMemo } from "react"
import { BookOpen } from "lucide-react"

export interface PickerTeacher {
  id:       string
  name:     string
  subjects: { id: string; name: string }[]
}

interface Props {
  teachers:   PickerTeacher[]
  teacherId:  string
  subjectId:  string
  onChange:   (next: { teacherId: string; subjectId: string }) => void
  disabled?:  boolean
  /** Classe dos dois selects — cada diálogo tem o seu padrão visual. */
  selectClassName?: string
  labelClassName?:  string
}

const SELECT_PADRAO =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"

export function TeacherSubjectPicker({
  teachers,
  teacherId,
  subjectId,
  onChange,
  disabled = false,
  selectClassName = SELECT_PADRAO,
  labelClassName  = "text-xs font-medium",
}: Props) {
  // Todas as matérias que alguém leciona, sem repetir
  const materias = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const t of teachers) for (const s of t.subjects) mapa.set(s.id, s.name)
    return [...mapa].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [teachers])

  // Professores que lecionam a matéria escolhida (todos, se nenhuma foi escolhida)
  const professores = useMemo(
    () => (subjectId ? teachers.filter(t => t.subjects.some(s => s.id === subjectId)) : teachers),
    [teachers, subjectId],
  )

  // Matérias do professor escolhido (todas, se nenhum foi escolhido)
  const materiasVisiveis = useMemo(() => {
    const t = teachers.find(x => x.id === teacherId)
    return t ? [...t.subjects].sort((a, b) => a.name.localeCompare(b.name)) : materias
  }, [teachers, teacherId, materias])

  function escolherMateria(novaMateria: string) {
    // Se o professor já escolhido não leciona a matéria nova, ele sai de cena
    const atual  = teachers.find(t => t.id === teacherId)
    const mantem = !novaMateria || !atual || atual.subjects.some(s => s.id === novaMateria)
    onChange({ subjectId: novaMateria, teacherId: mantem ? teacherId : "" })
  }

  function escolherProfessor(novoProfessor: string) {
    const prox   = teachers.find(t => t.id === novoProfessor)
    const mantem = !subjectId || !prox || prox.subjects.some(s => s.id === subjectId)
    onChange({ teacherId: novoProfessor, subjectId: mantem ? subjectId : "" })
  }

  const semProfessor = subjectId && professores.length === 0

  return (
    <>
      <div>
        <label className={labelClassName}>
          Matéria <span className="text-destructive">*</span>
        </label>
        <select
          value={subjectId}
          onChange={e => escolherMateria(e.target.value)}
          disabled={disabled || materiasVisiveis.length === 0}
          className={selectClassName}
        >
          <option value="">Selecionar matéria...</option>
          {materiasVisiveis.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClassName}>
          Professor <span className="text-destructive">*</span>
        </label>
        <select
          value={teacherId}
          onChange={e => escolherProfessor(e.target.value)}
          disabled={disabled || professores.length === 0}
          className={selectClassName}
        >
          <option value="">
            {semProfessor ? "Nenhum professor leciona esta matéria" : "Selecionar professor..."}
          </option>
          {professores.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {subjectId && professores.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <BookOpen className="w-3 h-3 shrink-0" />
            {professores.length} professor{professores.length !== 1 ? "es lecionam" : " leciona"}{" "}
            {materias.find(m => m.id === subjectId)?.name}
          </p>
        )}
      </div>
    </>
  )
}
