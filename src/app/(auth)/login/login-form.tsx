"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { loginAction } from "./actions"
import { Button }       from "@/components/ui/button"
import { Input }        from "@/components/ui/input"
import { Label }        from "@/components/ui/label"
import { Loader2 }      from "lucide-react"
import Link             from "next/link"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-11 font-sub font-semibold text-base rounded-lg">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
    </Button>
  )
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined)

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="font-sub font-medium">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
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
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          className="h-11 rounded-lg"
          required
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
