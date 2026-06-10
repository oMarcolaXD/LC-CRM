import Image                from "next/image"
import Link                 from "next/link"
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react"
import { ForgotPasswordForm } from "./forgot-password-form"

interface EsqueciSenhaPageProps {
  searchParams: Promise<{ error?: string; sent?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Informe um e-mail válido.",
}

export default async function EsqueciSenhaPage({ searchParams }: EsqueciSenhaPageProps) {
  const { error, sent } = await searchParams
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Erro ao processar sua solicitação. Tente novamente.") : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-[420px]">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="rounded-2xl overflow-hidden shadow-md">
            <Image src="/logo.svg" alt="Lição de Casa" width={72} height={72} priority />
          </div>
          <div className="text-center">
            <h1 className="font-heading text-2xl text-[#023047] dark:text-gray-100 tracking-wide leading-none">
              LIÇÃO DE CASA
            </h1>
          </div>
        </div>

        <div className="card-brand bg-card p-6">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="font-sub text-xl font-bold text-foreground">Verifique seu e-mail</h2>
              <p className="text-sm text-muted-foreground">
                Se houver uma conta cadastrada com esse e-mail, enviamos um link para redefinir sua senha.
                O link expira em 1 hora.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-sub text-xl font-bold text-foreground">Esqueci minha senha</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
              </p>

              {errorMessage && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <ForgotPasswordForm />
            </>
          )}
        </div>

        <div className="flex items-center justify-center mt-6">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>

      </div>
    </div>
  )
}
