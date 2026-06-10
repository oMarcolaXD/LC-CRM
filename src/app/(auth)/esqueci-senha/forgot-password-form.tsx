"use client"

import { forgotPasswordAction } from "./actions"
import { SubmitButton }         from "@/components/ui/submit-button"
import { Input }                from "@/components/ui/input"
import { Label }                from "@/components/ui/label"
import { Mail, ArrowRight }      from "lucide-react"

export function ForgotPasswordForm() {
  return (
    <form action={forgotPasswordAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="font-sub font-medium text-sm">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="seu@email.com"
            className="h-11 rounded-lg pl-9"
            autoComplete="email"
            required
          />
        </div>
      </div>

      <SubmitButton className="w-full h-11 font-sub font-semibold text-base rounded-lg gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 active:translate-y-0 active:shadow-none">
        <span>Enviar link de redefinição</span>
        <ArrowRight className="w-4 h-4" />
      </SubmitButton>
    </form>
  )
}
