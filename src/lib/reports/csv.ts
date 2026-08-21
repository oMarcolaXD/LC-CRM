// Geração de CSV para o Excel em português.
//
// Duas decisões que parecem detalhe e não são:
//
//   • separador ";" — o Excel pt-BR usa vírgula como decimal, então um CSV com
//     vírgula de separador abre com tudo numa coluna só;
//   • BOM UTF-8 no início — sem ele o Excel lê o arquivo como Latin-1 e todo
//     "Aulão" vira "AulÃ£o".
//
// Números saem com vírgula decimal e sem símbolo de moeda, para que o Excel os
// reconheça como número e permita somar.

export type CsvValue = string | number | null | undefined

export const CSV_BOM = "﻿"

function escape(v: CsvValue): string {
  if (v == null) return ""
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return ""
    // Contagens saem inteiras; valores e percentuais com 2 casas e vírgula decimal.
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")
  }
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface CsvSection {
  /** Linha de título acima da tabela; use para separar blocos no mesmo arquivo. */
  title?:  string
  headers: string[]
  rows:    CsvValue[][]
}

export function buildCsv(sections: CsvSection[]): string {
  const lines: string[] = []

  sections.forEach((s, i) => {
    if (i > 0) lines.push("")
    if (s.title) lines.push(escape(s.title))
    lines.push(s.headers.map(escape).join(";"))
    for (const row of s.rows) lines.push(row.map(escape).join(";"))
  })

  return CSV_BOM + lines.join("\r\n")
}

/** Nome de arquivo seguro: sem acento, espaço nem barra. */
export function csvFilename(report: string, periodLabel: string): string {
  const slug = periodLabel
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // tira os acentos
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${report}-${slug || "periodo"}.csv`
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  })
}
