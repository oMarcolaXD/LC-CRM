"use client"

import { useEffect } from "react"
import { Button }    from "@/components/ui/button"
import { Printer }   from "lucide-react"

export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <Button onClick={() => window.print()}>
      <Printer className="w-4 h-4 mr-2" />
      Imprimir / Baixar PDF
    </Button>
  )
}
