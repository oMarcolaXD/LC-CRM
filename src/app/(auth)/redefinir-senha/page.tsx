import Image                  from "next/image"
import Link                   from "next/link"
import { ArrowLeft, KeyRound, XCircle } from "lucide-react"
import { validatePasswordResetToken } from "@/lib/auth/password-reset"
import { ResetPasswordForm }  from "./reset-password-form"

interface RedefinirSenhaPageProps {
  searchParams: Promise<{ token?: string; error?: string }>
}

export default async function RedefinirSenhaPage({ searchParams }: RedefinirSenhaPageProps) {
  const { token, error } = await searchParams

  const tokenResult = token ? await validatePasswordResetToken(token) : null
  const tokenIsValid = !!tokenResult && error !== "expired"

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
          {tokenIsValid ? (
            <>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-sub text-xl font-bold text-foreground">Redefinir senha</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Crie uma nova senha para acessar sua conta.
              </p>

              <ResetPasswordForm token={token!} error={error} />
            </>
          ) : (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <h2 className="font-sub text-xl font-bold text-foreground">Link inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este link de redefinição de senha não é mais válido. Solicite um novo link para continuar.
              </p>
              <Link
                href="/esqueci-senha"
                className="mt-2 text-sm font-semibold text-primary hover:underline"
              >
                Solicitar novo link
              </Link>
            </div>
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
