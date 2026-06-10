"use client"

import { resetPasswordAction } from "./actions"
import { SubmitButton }         from "@/components/ui/submit-button"
import { Input }                from "@/components/ui/input"
import { Label }                from "@/components/ui/label"
import { AlertCircle, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { useState } from "react"

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Verifique os dados informados. A senha deve ter no mínimo 8 caracteres, com letra maiúscula, número e caractere especial, e as senhas devem coincidir.",
}

export function ResetPasswordForm({ token, error }: { token: string; error?: string }) {
  const [showPassword, setShowPassword]               = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const message = error ? (ERROR_MESSAGES[error] ?? "Erro ao redefinir a senha. Tente novamente.") : null

  return (
    <form action={resetPasswordAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="password" className="font-sub font-medium text-sm">Nova senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="h-11 rounded-lg pl-9 pr-10"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Mínimo 8 caracteres, com letra maiúscula, número e caractere especial.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="font-sub font-medium text-sm">Confirmar nova senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            className="h-11 rounded-lg pl-9 pr-10"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}

      <SubmitButton className="w-full h-11 font-sub font-semibold text-base rounded-lg gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 active:translate-y-0 active:shadow-none">
        <span>Redefinir senha</span>
        <ArrowRight className="w-4 h-4" />
      </SubmitButton>
    </form>
  )
}
