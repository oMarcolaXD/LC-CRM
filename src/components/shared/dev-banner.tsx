"use client"

import { useState, useEffect } from "react"
import { X, FlaskConical }     from "lucide-react"

const STORAGE_KEY = "dev-banner-dismissed"

export function DevBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 bg-violet-500/10 border-b border-violet-500/20 px-4 md:px-6 py-2 text-violet-700 dark:text-violet-300">
      <FlaskConical className="shrink-0 w-3.5 h-3.5" />
      <p className="flex-1 text-xs font-body">
        <span className="font-semibold">Versão beta</span> — o sistema está em desenvolvimento.
        Você pode encontrar erros ou instabilidades. Relate qualquer problema ao administrador.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="shrink-0 rounded p-0.5 hover:bg-violet-500/15 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
