"use client"

import { useFormStatus } from "react-dom"
import { loginAction }   from "./actions"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Label }   from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import Link        from "next/link"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-11 font-sub font-semibold text-base rounded-lg">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
    </Button>
  )
}

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "E-mail ou senha incorretos.",
  invalid:     "Preencha o e-mail e a senha corretamente.",
}

export function LoginForm({ error }: { error?: string }) {
  const message = error ? (ERROR_MESSAGES[error] ?? "Erro ao fazer login. Tente novamente.") : null

  return (
    <form action={loginAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="font-sub font-medium">E-mail</Label>
        <Input
          id="email" name="email" type="email"
          placeholder="seu@email.com"
          className="h-11 rounded-lg"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="font-sub font-medium">Senha</Label>
          <Link href="/esqueci-senha" className="text-xs text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Input
          id="password" name="password" type="password"
          placeholder="••••••••"
          className="h-11 rounded-lg"
          required
        />
      </div>

      {message && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}

      <SubmitButton />
    </form>
  )
}
