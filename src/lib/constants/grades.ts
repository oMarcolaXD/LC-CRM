// Lista canônica de séries/anos escolares (campo `Student.grade`).
// Fonte única de verdade — todos os formulários devem importar daqui para
// evitar divergência de grafia ("6º EF" vs "6º Ano EF") e duplicatas nos filtros.

export const GRADE_GROUPS = [
  { label: "Ensino Fundamental", grades: ["6º EF", "7º EF", "8º EF", "9º EF"] },
  { label: "Ensino Médio",       grades: ["1º EM", "2º EM", "3º EM"]          },
  { label: "Superior & Outros",  grades: ["Vestibular", "ENEM", "Concurso", "Superior"] },
] as const

// Lista achatada, na ordem de exibição.
export const GRADES: string[] = GRADE_GROUPS.flatMap((g) => g.grades)

// Séries tratadas como "adulto" (aluno pode ser o próprio responsável).
export const ADULT_GRADES = new Set<string>(["Vestibular", "ENEM", "Concurso", "Superior"])

export const DEFAULT_GRADE = "6º EF"

// Mapa de normalização: grafias antigas → grafia canônica.
// Usado pelo script scripts/normalize-grades.ts e como saneamento defensivo.
const GRADE_ALIASES: Record<string, string> = {
  // Formato extenso "N Ano EF/EM" → compacto
  "6º Ano EF": "6º EF",
  "7º Ano EF": "7º EF",
  "8º Ano EF": "8º EF",
  "9º Ano EF": "9º EF",
  "1º Ano EM": "1º EM",
  "2º Ano EM": "2º EM",
  "3º Ano EM": "3º EM",
  // Categorias de adulto aposentadas → equivalente canônico
  "Cursinho": "Vestibular",
  "Graduação": "Superior",
  "Pós-graduação": "Superior",
  "Pós-Graduação": "Superior",
}

/**
 * Normaliza um valor de série para a grafia canônica.
 * Retorna o valor original (trim) quando não há alias conhecido — assim
 * valores fora do catálogo (ex.: "Outro", texto livre legado) não são perdidos.
 */
export function normalizeGrade(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const value = raw.trim()
  if (value === "") return null
  return GRADE_ALIASES[value] ?? value
}
