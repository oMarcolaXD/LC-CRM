"use client"

import { useState, useRef }   from "react"
import { PageHeader }          from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge }               from "@/components/ui/badge"
import Link                    from "next/link"
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle,
  AlertCircle, Loader2, Download,
} from "lucide-react"
import { importStudentsAction, type ImportResult } from "@/lib/actions/colaborador"

// ─── Colunas esperadas ──────────────────────────────────────────────────────
const COLUMNS = [
  "nome", "email", "senha", "telefone", "dataNascimento",
  "serie", "escola", "nomeResponsavel", "telefoneResponsavel", "emailResponsavel",
] as const

const REQUIRED: (typeof COLUMNS[number])[] = ["nome", "email"]

const COLUMN_LABELS: Record<typeof COLUMNS[number], string> = {
  nome:                "Nome",
  email:               "E-mail",
  senha:               "Senha",
  telefone:            "Telefone",
  dataNascimento:      "Data de Nascimento",
  serie:               "Série",
  escola:              "Escola",
  nomeResponsavel:     "Nome do Responsável",
  telefoneResponsavel: "Tel. Responsável",
  emailResponsavel:    "E-mail do Responsável",
}

// ─── Parse CSV ───────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? "" })
    return row
  })
}

// ─── Template CSV content ────────────────────────────────────────────────────
const TEMPLATE_CSV =
  COLUMNS.join(",") + "\n" +
  "Lucas Oliveira,lucas@email.com,Aluno@2025,(11) 99999-0000,15/03/2010,9º Ano EF,Colégio São Paulo,Maria Oliveira,(11) 99999-0001,maria@email.com\n" +
  "Ana Beatriz,ana@email.com,Aluno@2025,(21) 98888-1111,22/07/2008,2º Ano EM,Escola Estadual,,,"

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = "template-importacao-alunos.csv"
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function ImportarAlunosPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [rows,     setRows]     = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<ImportResult | null>(null)
  const [parseErr, setParseErr] = useState("")

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setParseErr("")

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setParseErr("Arquivo vazio ou formato inválido. Certifique-se de que é um CSV com cabeçalho.")
        setRows([])
      } else {
        setRows(parsed)
      }
    }
    reader.readAsText(file, "UTF-8")
  }

  async function handleImport() {
    if (rows.length === 0) return
    setLoading(true)
    try {
      const res = await importStudentsAction(rows)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IMPORTAR ALUNOS"
        description="Cadastre múltiplos alunos de uma vez via planilha CSV"
        backHref="/colaborador/alunos"
      />

      {/* ── Upload ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Selecionar arquivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 py-10 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Clique para selecionar o arquivo</p>
              <p className="text-xs text-muted-foreground mt-1">CSV ou Excel exportado como CSV — UTF-8</p>
            </div>
            {fileName && (
              <Badge variant="secondary" className="font-mono text-xs">{fileName}</Badge>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
          />

          {parseErr && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {parseErr}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar template CSV
            </Button>

            {rows.length > 0 && !result && (
              <Button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Importando…</>
                  : <><Upload className="w-4 h-4" />Importar {rows.length} aluno{rows.length !== 1 ? "s" : ""}</>
                }
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Resultado ────────────────────────────────────────────── */}
      {result && (
        <Card className={result.errors.length === 0 ? "border-green-200" : "border-amber-200"}>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              {result.errors.length === 0
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <AlertCircle className="w-4 h-4 text-amber-600" />
              }
              Resultado da importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">{result.success} cadastrado{result.success !== 1 ? "s" : ""} com sucesso</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700 font-medium">{result.errors.length} erro{result.errors.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold">Linha</th>
                      <th className="text-left px-3 py-2 font-semibold">E-mail</th>
                      <th className="text-left px-3 py-2 font-semibold">Motivo do erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="text-destructive/80">
                        <td className="px-3 py-2 font-mono">{err.row}</td>
                        <td className="px-3 py-2">{err.email || "—"}</td>
                        <td className="px-3 py-2">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <Link href="/colaborador/alunos" className={buttonVariants({ variant: "default", size: "sm" }) + " gap-2"}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ver alunos
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setRows([]); setResult(null); setFileName(""); if (inputRef.current) inputRef.current.value = "" }}
              >
                Nova importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pré-visualização ─────────────────────────────────────── */}
      {rows.length > 0 && !result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              Pré-visualização
              <Badge variant="secondary">{rows.length} linha{rows.length !== 1 ? "s" : ""}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {COLUMNS.map(col => (
                      <th key={col} className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                        {COLUMN_LABELS[col]}
                        {REQUIRED.includes(col) && <span className="text-destructive ml-0.5">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 20).map((row, i) => {
                    const hasError = REQUIRED.some(c => !row[c])
                    return (
                      <tr key={i} className={hasError ? "bg-destructive/5" : "hover:bg-muted/20"}>
                        {COLUMNS.map(col => (
                          <td key={col} className="px-3 py-2 whitespace-nowrap text-muted-foreground max-w-[160px] truncate">
                            {row[col] || <span className="italic opacity-40">—</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-xs text-center text-muted-foreground py-2 border-t border-border">
                  … e mais {rows.length - 20} linha{rows.length - 20 !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Template de referência ───────────────────────────────── */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="font-sub text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Estrutura esperada do arquivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold">Coluna</th>
                  <th className="text-left px-3 py-2 font-semibold">Obrigatório</th>
                  <th className="text-left px-3 py-2 font-semibold">Formato / Exemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["nome",                "Sim",  "Lucas Oliveira"],
                  ["email",               "Sim",  "lucas@email.com"],
                  ["senha",               "Não",  "Padrão: Aluno@2025"],
                  ["telefone",            "Não",  "(11) 99999-0000"],
                  ["dataNascimento",       "Não",  "DD/MM/AAAA — ex: 15/03/2010"],
                  ["serie",               "Não",  "9º Ano EF · 2º Ano EM · Graduação"],
                  ["escola",              "Não",  "Colégio São Paulo"],
                  ["nomeResponsavel",      "Não",  "Maria Oliveira"],
                  ["telefoneResponsavel",  "Não",  "(11) 99999-0001"],
                  ["emailResponsavel",     "Não",  "maria@email.com"],
                ].map(([col, req, ex]) => (
                  <tr key={col} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-primary">{col}</td>
                    <td className="px-3 py-2">
                      {req === "Sim"
                        ? <span className="text-destructive font-semibold">Sim</span>
                        : <span className="text-muted-foreground">Não</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar template CSV preenchido
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
