import { PageHeader }      from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input }             from "@/components/ui/input"
import { Label }             from "@/components/ui/label"
import Link                  from "next/link"
import { createStudentWithGuardianAction } from "@/lib/actions/colaborador"
import { GraduationCap, UserRound, KeyRound, AlertCircle, History } from "lucide-react"
import { prisma }            from "@/lib/prisma"
import { PastLessonsInput }  from "@/components/shared/past-lessons-input"

const GRADES = [
  "6º Ano EF", "7º Ano EF", "8º Ano EF", "9º Ano EF",
  "1º Ano EM", "2º Ano EM", "3º Ano EM",
  "Cursinho", "Graduação", "Pós-graduação", "Outro",
]

interface NovoAlunoPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NovoAlunoPage({ searchParams }: NovoAlunoPageProps) {
  const { error } = await searchParams

  const [teachers, subjects] = await Promise.all([
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ])

  const teacherList = teachers.map(t => ({ id: t.id, name: t.user.name }))
  const subjectList = subjects.map(s => ({ id: s.id, name: s.name }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="NOVO ALUNO"
        description="Cadastre um aluno e seu responsável"
        backHref="/colaborador/alunos"
      />

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={createStudentWithGuardianAction} className="space-y-6">

        {/* ── Dados do Aluno ─────────────────────────────────────── */}
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
                <Input id="name" name="name" placeholder="Ex: Lucas Oliveira" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <Input id="phone" name="phone" placeholder="(11) 99999-0000" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" name="email" type="email" placeholder="aluno@email.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade">Série / Ano</Label>
                <select id="grade" name="grade"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
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

        {/* ── Senha de Acesso ────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Senha de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password" name="password" type="text"
                  placeholder="Mínimo 6 caracteres"
                  defaultValue="Aluno@2025"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Compartilhe esta senha com o aluno. Ele poderá alterá-la após o primeiro acesso.
            </p>
          </CardContent>
        </Card>

        {/* ── Responsável (opcional) ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              Responsável
              <span className="text-xs font-normal text-muted-foreground">(opcional — para alunos menores)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianName">Nome do responsável</Label>
                <Input id="guardianName" name="guardianName" placeholder="Ex: Maria Oliveira" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">WhatsApp do responsável</Label>
                <Input id="guardianPhone" name="guardianPhone" placeholder="(11) 99999-0001" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianEmail">E-mail do responsável</Label>
                <Input id="guardianEmail" name="guardianEmail" type="email" placeholder="responsavel@email.com" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao preencher o nome, um perfil de responsável será criado automaticamente e vinculado ao aluno.
            </p>
          </CardContent>
        </Card>

        {/* ── Aulas Já Realizadas (opcional) ─────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Aulas Já Realizadas
              <span className="text-xs font-normal text-muted-foreground">(opcional — para alunos com histórico)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PastLessonsInput teachers={teacherList} subjects={subjectList} />
            <p className="text-xs text-muted-foreground mt-3">
              Registre aulas realizadas antes do cadastro no sistema. Elas ficam com status <strong>Concluída</strong> e aparecem no histórico do aluno.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href="/colaborador/alunos" className={buttonVariants({ variant: "outline" })}>
            Cancelar
          </Link>
          <Button type="submit">
            <GraduationCap className="w-4 h-4 mr-2" />
            Cadastrar Aluno
          </Button>
        </div>

      </form>
    </div>
  )
}
