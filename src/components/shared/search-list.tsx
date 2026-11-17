"use client"

import { useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Listas com busca (alunos, responsáveis…). Com centenas de nomes, rolar a
 * lista até a letra certa era inviável: aqui se digita parte do nome do aluno
 * OU do responsável e a lista filtra na hora, sem ligar para acento/maiúscula.
 */

export interface SearchItem {
  id:        string
  label:     string
  /** Linha secundária (ex.: "Resp: Fulana · 3 aulas restantes"). */
  hint?:     string | null
  /** Texto extra que também é pesquisado (ex.: nome do responsável). */
  keywords?: string | null
}

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function filtrar(items: SearchItem[], termo: string): SearchItem[] {
  const t = normalizar(termo)
  if (!t) return items
  const partes = t.split(/\s+/)
  return items.filter((i) => {
    // Só o nome (e palavras-chave explícitas, ex.: telefone): o texto cinza de
    // apoio não entra, senão "fernanda" traria alunos cuja mãe é Fernanda.
    const alvo = normalizar(`${i.label} ${i.keywords ?? ""}`)
    return partes.every((p) => alvo.includes(p))
  })
}

function CampoBusca({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  )
}

/** Lista com busca e seleção múltipla (ou única, conforme o pai trata o clique). */
export function SearchList({
  items, selectedIds, onToggle, isDisabled, placeholder = "Buscar pelo nome…",
  emptyText = "Nenhum resultado", className, listClassName = "max-h-44",
}: {
  items:        SearchItem[]
  selectedIds:  string[]
  onToggle:     (id: string) => void
  isDisabled?:  (id: string) => boolean
  placeholder?: string
  emptyText?:   string
  className?:   string
  listClassName?: string
}) {
  const [termo, setTermo] = useState("")
  const visiveis = useMemo(() => filtrar(items, termo), [items, termo])

  return (
    <div className={cn("space-y-1.5", className)}>
      <CampoBusca value={termo} onChange={setTermo} placeholder={placeholder} />
      <div className={cn("overflow-y-auto rounded-lg border border-input bg-background divide-y", listClassName)}>
        {visiveis.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : visiveis.map((i) => {
          const selected = selectedIds.includes(i.id)
          const disabled = !selected && (isDisabled?.(i.id) ?? false)
          return (
            <button
              key={i.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(i.id)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm transition-colors",
                selected ? "bg-primary/10 text-primary font-medium"
                  : disabled ? "cursor-not-allowed text-muted-foreground/40"
                  : "hover:bg-muted/50",
              )}
            >
              <span className="block break-words">{i.label}</span>
              {i.hint && <span className="block text-[11px] font-normal text-muted-foreground break-words">{i.hint}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Seleção única com busca. Mostra o escolhido como um "cartão" com botão de
 * trocar; a lista só aparece enquanto se escolhe. `name` grava num input
 * hidden, para funcionar dentro de <form> de server action.
 */
export function SearchSelect({
  items, value, onChange, name, placeholder = "Buscar pelo nome…",
  emptyText = "Nenhum resultado", noneLabel, listClassName = "max-h-52",
}: {
  items:        SearchItem[]
  value:        string
  onChange?:    (id: string) => void
  name?:        string
  placeholder?: string
  emptyText?:   string
  /** Se informado, permite limpar a escolha (ex.: "Nenhum responsável"). */
  noneLabel?:   string
  listClassName?: string
}) {
  const [interno, setInterno] = useState(value)
  const atual = onChange ? value : interno
  const [aberto, setAberto] = useState(!atual)
  const escolhido = items.find((i) => i.id === atual)

  function escolher(id: string) {
    if (onChange) onChange(id)
    else setInterno(id)
    setAberto(id === "")
  }

  return (
    <div className="space-y-1.5">
      {name && <input type="hidden" name={name} value={atual} />}
      {escolhido && !aberto ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium break-words">{escolhido.label}</p>
            {escolhido.hint && <p className="text-[11px] text-muted-foreground break-words">{escolhido.hint}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setAberto(true)} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
              Trocar
            </button>
            {noneLabel && (
              <button type="button" onClick={() => escolher("")} title={noneLabel} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {!escolhido && noneLabel && (
            <p className="text-[11px] text-muted-foreground">{noneLabel}</p>
          )}
          <SearchList
            items={items}
            selectedIds={atual ? [atual] : []}
            onToggle={escolher}
            placeholder={placeholder}
            emptyText={emptyText}
            listClassName={listClassName}
          />
          {escolhido && (
            <button type="button" onClick={() => setAberto(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Manter {escolhido.label}
            </button>
          )}
        </>
      )}
    </div>
  )
}
