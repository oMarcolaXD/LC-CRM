"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
        </div>
        <h1 className="font-heading text-2xl">Algo deu errado</h1>
        <p className="text-muted-foreground text-sm">
          Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60">Código: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  )
}
