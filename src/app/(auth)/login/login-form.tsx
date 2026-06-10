"use client"

import { loginAction }    from "./actions"
import { GoogleButton }   from "./google-button"
import { SubmitButton }   from "@/components/ui/submit-button"
import { Input }          from "@/components/ui/input"
import { Label }          from "@/components/ui/label"
import { Checkbox }       from "@/components/ui/checkbox"
import {
  AlertCircle, CheckCircle2, Mail, Lock, Eye, EyeOff,
  Headphones, ShieldCheck, ArrowRight,
} from "lucide-react"
import Link               from "next/link"
import { useState }       from "react"


const ERROR_MESSAGES: Record<string, string> = {
  credentials:             "E-mail, telefone ou senha incorretos.",
  invalid:                 "Preencha o e-mail ou telefone e a senha corretamente.",
  not_registered:          "Sua conta Google não está cadastrada no sistema. Entre em contato com o administrador.",
  account_inactive:        "Sua conta está inativa. Entre em contato com o administrador.",
  student_login_disabled:  "Alunos não fazem login diretamente. Peça ao responsável para acessar o sistema.",
}

const SUCCESS_MESSAGES: Record<string, string> = {
  password_reset: "Senha redefinida com sucesso! Faça login com sua nova senha.",
}

export function LoginForm({ error, success }: { error?: string; success?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const message      = error   ? (ERROR_MESSAGES[error] ?? "Erro ao fazer login. Tente novamente.") : null
  const successMessage = success ? (SUCCESS_MESSAGES[success] ?? null) : null

  return (
    <div className="space-y-5">

      <form action={loginAction} className="space-y-4">

        {/* Sucesso */}
        {successMessage && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-2.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* E-mail ou Telefone */}
        <div className="space-y-1.5">
          <Label htmlFor="emailOrPhone" className="font-sub font-medium text-sm">
            E-mail ou Telefone
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="emailOrPhone"
              name="emailOrPhone"
              type="text"
              placeholder="seu@email.com ou 11999990001"
              className="h-11 rounded-lg pl-9"
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-sub font-medium text-sm">Senha</Label>
            <Link href="/esqueci-senha" className="text-xs text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="h-11 rounded-lg pl-9 pr-10"
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
        </div>

        {/* Lembrar de mim */}
        <div className="flex items-center gap-2">
          <Checkbox id="remember" name="remember" />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
            Lembrar de mim
          </Label>
        </div>

        {/* Erro */}
        {message && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {message}
          </div>
        )}

        <SubmitButton className="w-full h-11 font-sub font-semibold text-base rounded-lg gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 active:translate-y-0 active:shadow-none">
          <span>Entrar</span>
          <ArrowRight className="w-4 h-4" />
        </SubmitButton>
      </form>

      {/* Divider */}
      <div className="relative flex items-center gap-3 text-muted-foreground text-xs">
        <div className="flex-1 h-px bg-border" />
        <span>ou</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Google */}
      <GoogleButton />

      {/* Suporte */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Headphones className="w-4 h-4 shrink-0" />
        <span>
          Precisa de ajuda?{" "}
          <a
            href="https://wa.me/5515996279639"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Fale com o nosso suporte
          </a>
        </span>
      </div>

      {/* LGPD */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Seus dados estão protegidos.</span>{" "}
          Tratamos suas informações conforme a LGPD (Lei nº&nbsp;13.709/2018). Ao acessar o sistema,
          você confirma ter lido nossa{" "}
          <Link href="/politica-de-privacidade" className="text-primary hover:underline font-medium">
            Política de Privacidade
          </Link>.
        </p>
      </div>

      {/* Copyright */}
      <p className="text-center text-xs text-muted-foreground">
        Lição de Casa CRM © 2026 — Todos os direitos reservados.
      </p>

    </div>
  )
}
