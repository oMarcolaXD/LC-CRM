"use client"

import { useState, useRef }  from "react"
import Link                   from "next/link"
import { createStudentWithGuardianAction } from "@/lib/actions/colaborador"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { PastLessonsInput } from "@/components/shared/past-lessons-input"
import { PastPaymentsInput } from "@/components/shared/past-payments-input"
import { PhoneInput }        from "@/components/ui/phone-input"
import {
  GraduationCap, UserRound, KeyRound, History, CreditCard,
  Package, UserX, ClipboardList, CheckCircle2, Loader2, Mail,
} from "lucide-react"

const GRADES = [
  "6º Ano EF", "7º Ano EF", "8º Ano EF", "9º Ano EF",
  "1º Ano EM", "2º Ano EM", "3º Ano EM",
  "Cursinho", "Graduação", "Pós-graduação", "Outro",
]

interface Teacher { id: string; name: string }
interface Subject { id: string; name: string }

interface PastLesson {
  date: string; time: string; teacherId: string; subjectId: string
  duration: string; modality: string; topics: string; status: "COMPLETED" | "MISSED"
}
interface PastPayment {
  amount: string; dueDate: string; paidAt: string; status: string; method: string; description: string
}

export function NovoAlunoForm({
  teachers,
  subjects,
}: {
  teachers: Teacher[]
  subjects: Subject[]
}) {
  const [studentName,    setStudentName]    = useState("")
  const [grade,          setGrade]          = useState("")
  const [inactive,       setInactive]       = useState(false)
  const [packageLessons,   setPackageLessons]   = useState("")
  const [packageRemaining, setPackageRemaining] = useState("")
  const [packagePrice,     setPackagePrice]     = useState("")
  const [pastLessons,    setPastLessons]    = useState<PastLesson[]>([])
  const [pastPayments,   setPastPayments]   = useState<PastPayment[]>([])
  const [manualPassword, setManualPassword] = useState(false)
  const [pending,        setPending]        = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const lessonsDone   = pastLessons.filter(l => l.status === "COMPLETED").length
  const lessonsMissed = pastLessons.filter(l => l.status === "MISSED").length
  const paymentTotal  = pastPayments
    .filter(p => p.status === "PAID")
    .reduce((s, p) => s + parseFloat(p.amount.replace(",", ".") || "0"), 0)

  const hasPackage     = Boolean(packageLessons && parseInt(packageLessons) > 0)
  const hasLessons     = pastLessons.length > 0
  const hasPayments    = pastPayments.length > 0
  const readyToSubmit  = studentName.trim().length >= 3

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!readyToSubmit || pending) return
    setPending(true)
    const fd = new FormData(formRef.current!)
    await createStudentWithGuardianAction(fd)
    setPending(false)
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_288px] lg:gap-6 space-y-6 lg:space-y-0">
      {/* ── Coluna principal ─────────────────────────────────────────── */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

        {/* Dados do Aluno */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              Dados do Aluno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name" name="name"
                  placeholder="Ex: Lucas Oliveira"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <PhoneInput id="phone" name="phone" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="aluno@email.com" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade">Série / Ano</Label>
                <select
                  id="grade" name="grade"
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione</option>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">Escola / Instituição</Label>
                <Input id="school" name="school" placeholder="Ex: Colégio São Paulo" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Senha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Senha de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Modo padrão: e-mail automático */}
            {!manualPassword && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Senha aleatória por e-mail
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    Uma senha segura será gerada automaticamente e enviada para o e-mail do aluno no momento do cadastro.
                  </p>
                </div>
              </div>
            )}

            {/* Modo manual: campo de senha */}
            {manualPassword && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password" name="password" type="text"
                    placeholder="Mínimo 6 caracteres"
                    required={manualPassword}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <input
                type="checkbox"
                name="skipEmail"
                checked={manualPassword}
                onChange={e => setManualPassword(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-muted-foreground">
                Definir senha manualmente (não enviar e-mail)
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Responsável */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              Responsável
              <span className="text-xs font-normal text-muted-foreground">(obrigatório)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianName">Nome do responsável *</Label>
                <Input id="guardianName" name="guardianName" placeholder="Ex: Maria Oliveira" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">WhatsApp do responsável *</Label>
                <PhoneInput id="guardianPhone" name="guardianPhone" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianEmail">E-mail do responsável *</Label>
                <Input id="guardianEmail" name="guardianEmail" type="email" placeholder="responsavel@email.com" autoComplete="off" required />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O responsável usa este e-mail para acessar o sistema e acompanhar o aluno. Um perfil será criado e vinculado automaticamente.
            </p>
          </CardContent>
        </Card>

        {/* Pacote Inicial */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Pacote Inicial
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packageLessons">Total de aulas</Label>
                <Input
                  id="packageLessons" name="packageLessons" type="number" min={1}
                  placeholder="Ex: 10"
                  value={packageLessons}
                  onChange={e => {
                    setPackageLessons(e.target.value)
                    setPackageRemaining(e.target.value)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageRemaining">Aulas restantes</Label>
                <Input
                  id="packageRemaining" name="packageRemaining" type="number" min={0}
                  placeholder={packageLessons || "0"}
                  value={packageRemaining}
                  onChange={e => setPackageRemaining(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packagePrice">Preço por aula (R$)</Label>
                <Input
                  id="packagePrice" name="packagePrice" type="text" inputMode="decimal"
                  placeholder="0,00"
                  value={packagePrice}
                  onChange={e => setPackagePrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageExpires">Validade (dias)</Label>
                <Input
                  id="packageExpires" name="packageExpires" type="number" min={1}
                  placeholder="Ex: 90"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packageDate">Data de compra</Label>
                <Input
                  id="packageDate" name="packageDate" type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Registre o pacote vigente para que o saldo de aulas apareça corretamente na ficha.
            </p>
          </CardContent>
        </Card>

        {/* Aulas Já Realizadas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Aulas Já Realizadas
              <span className="text-xs font-normal text-muted-foreground">(opcional — histórico antes do sistema)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PastLessonsInput
              teachers={teachers}
              subjects={subjects}
              onChange={setPastLessons}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Registre aulas realizadas antes do cadastro no sistema. Você pode marcar cada uma como <strong>Realizada</strong> ou <strong>Faltou</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Pagamentos Anteriores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Pagamentos Anteriores
              <span className="text-xs font-normal text-muted-foreground">(opcional — recibos passados)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PastPaymentsInput onChange={setPastPayments} />
            <p className="text-xs text-muted-foreground mt-3">
              Registre recibos e cobranças anteriores ao sistema. Informe o método, a data de pagamento e a referência.
            </p>
          </CardContent>
        </Card>

        {/* Ex-aluno */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <UserX className="w-4 h-4 text-primary" />
              Status do Aluno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="inactive"
                checked={inactive}
                onChange={e => setInactive(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  Este é um ex-aluno (inativo)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O histórico será importado, mas o aluno não aparecerá na lista padrão de ativos.
                </p>
              </div>
            </label>

            {inactive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                <div className="space-y-2">
                  <Label htmlFor="inactiveDate">Data de saída</Label>
                  <Input id="inactiveDate" name="inactiveDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inactiveReason">Motivo (opcional)</Label>
                  <Input
                    id="inactiveReason" name="inactiveReason"
                    placeholder="Ex: Troca de escola, mudança de cidade…"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botões rodapé (mobile) */}
        <div className="flex gap-3 justify-end lg:hidden">
          <Link href="/colaborador/alunos" className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </Link>
          <Button type="submit" disabled={!readyToSubmit || pending}>
            {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-2" />}
            Cadastrar Aluno
          </Button>
        </div>
      </form>

      {/* ── Painel de resumo (desktop sticky) ────────────────────────── */}
      <aside className="lg:block">
        <div className="lg:sticky lg:top-6 space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Resumo do Cadastro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Nome */}
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className={studentName.trim() ? "font-medium" : "text-muted-foreground italic"}>
                  {studentName.trim() || "Nome não preenchido"}
                </span>
              </div>

              {/* Série */}
              {grade && (
                <div className="text-xs text-muted-foreground pl-6">{grade}</div>
              )}

              {/* Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${inactive ? "bg-gray-400" : "bg-green-500"}`} />
                <span className="text-xs text-muted-foreground">
                  {inactive ? "Ex-aluno (inativo)" : "Aluno ativo"}
                </span>
              </div>

              {/* Pacote */}
              <div className={`flex items-start gap-2 ${!hasPackage ? "opacity-40" : ""}`}>
                <Package className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {hasPackage ? (
                    <>
                      <p className="font-medium">{packageLessons} aulas</p>
                      {packagePrice && (
                        <p className="text-xs text-muted-foreground">
                          R$ {(parseFloat(packagePrice.replace(",", ".")) * parseInt(packageLessons || "0"))
                            .toLocaleString("pt-BR", { minimumFractionDigits: 2 })} total
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sem pacote</span>
                  )}
                </div>
              </div>

              {/* Aulas */}
              <div className={`flex items-start gap-2 ${!hasLessons ? "opacity-40" : ""}`}>
                <History className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {hasLessons ? (
                    <>
                      <p className="font-medium">{pastLessons.length} aula{pastLessons.length !== 1 ? "s" : ""} no histórico</p>
                      <p className="text-xs text-muted-foreground">
                        {lessonsDone} realizada{lessonsDone !== 1 ? "s" : ""}
                        {lessonsMissed > 0 && ` · ${lessonsMissed} falta${lessonsMissed !== 1 ? "s" : ""}`}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sem histórico de aulas</span>
                  )}
                </div>
              </div>

              {/* Pagamentos */}
              <div className={`flex items-start gap-2 ${!hasPayments ? "opacity-40" : ""}`}>
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {hasPayments ? (
                    <>
                      <p className="font-medium">{pastPayments.length} pagamento{pastPayments.length !== 1 ? "s" : ""}</p>
                      {paymentTotal > 0 && (
                        <p className="text-xs text-muted-foreground">
                          R$ {paymentTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pagos
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sem pagamentos</span>
                  )}
                </div>
              </div>

              {readyToSubmit && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Pronto para cadastrar
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botão Cadastrar (desktop) */}
          <div className="hidden lg:flex flex-col gap-2">
            <Button
              type="submit"
              form="novo-aluno-form-ref"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={!readyToSubmit || pending}
              className="w-full"
            >
              {pending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                : <><GraduationCap className="w-4 h-4 mr-2" /> Cadastrar Aluno</>
              }
            </Button>
            <Link href="/colaborador/alunos" className={buttonVariants({ variant: "outline" }) + " w-full text-center"}>
              Cancelar
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
