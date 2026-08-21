"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
        </div>
        <h2 className="font-heading text-xl">Não foi possível carregar</h2>
        <p className="text-muted-foreground text-sm">
          Algo deu errado ao abrir esta página. Tente novamente — se continuar,
          avise o suporte informando o código abaixo.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60">Código de suporte: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => history.back()}>Voltar</Button>
        </div>
      </div>
    </div>
  )
}
