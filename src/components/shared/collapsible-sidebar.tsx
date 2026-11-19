"use client"

import { useEffect, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

const CHAVE = "lc-barra-lateral-recolhida"

/**
 * Barra lateral (desktop) que pode ser recolhida para dar a largura da tela
 * ao conteúdo — principalmente à agenda. A escolha fica salva neste navegador.
 * Recolhida, vira uma faixa fina com o botão para abrir de novo.
 * No celular nada muda: lá o menu já abre por cima, pelo botão do cabeçalho.
 */
export function CollapsibleSidebar({ children }: { children: React.ReactNode }) {
  const [recolhida, setRecolhida] = useState(false)

  useEffect(() => {
    try { setRecolhida(localStorage.getItem(CHAVE) === "1") } catch { /* sem storage: fica aberta */ }
  }, [])

  function alternar() {
    setRecolhida((r) => {
      const nova = !r
      try { localStorage.setItem(CHAVE, nova ? "1" : "0") } catch { /* ignora */ }
      // Telas que calculam o próprio tamanho (agenda) se reajustam
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
      return nova
    })
  }

  return (
    <aside
      className={`relative hidden lg:flex shrink-0 flex-col transition-[width] duration-200 ${recolhida ? "w-10" : "w-60"}`}
    >
      {recolhida ? (
        <div className="flex h-full flex-col items-center border-r border-sidebar-border bg-sidebar pt-4">
          <button
            type="button"
            onClick={alternar}
            title="Mostrar menu"
            aria-label="Mostrar menu"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          {children}
          <button
            type="button"
            onClick={alternar}
            title="Esconder menu (mais espaço para a agenda)"
            aria-label="Esconder menu"
            className="absolute right-2 top-5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </>
      )}
    </aside>
  )
}
