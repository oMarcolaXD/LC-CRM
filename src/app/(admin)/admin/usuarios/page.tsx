import Link              from "next/link"
import { prisma }        from "@/lib/prisma"
import { Button }        from "@/components/ui/button"
import { Input }         from "@/components/ui/input"
import { Badge }         from "@/components/ui/badge"
import { Card }          from "@/components/ui/card"
import { PageHeader }    from "@/components/shared/page-header"
import { RoleBadge }     from "@/components/shared/role-badge"
import { LinkButton }    from "@/components/shared/link-button"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import { UserPlus, Pencil, Search } from "lucide-react"
import { format }        from "date-fns"
import { ptBR }          from "date-fns/locale"
import type { Role }     from "@prisma/client"

const ROLE_FILTER: Record<string, Role | undefined> = {
  ADMIN: "ADMIN", COLLABORATOR: "COLLABORATOR",
  TEACHER: "TEACHER", STUDENT: "STUDENT", GUARDIAN: "GUARDIAN",
}

interface UsuariosPageProps {
  searchParams: Promise<{ q?: string; role?: string; success?: string }>
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const { q, role, success } = await searchParams
  const roleFilter = role ? ROLE_FILTER[role] : undefined

  const users = await prisma.user.findMany({
    where: {
      ...(roleFilter && { role: roleFilter }),
      ...(q && {
        OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const counts = await prisma.user.groupBy({ by: ["role"], _count: true })
  const countMap = Object.fromEntries(counts.map((c) => [c.role, c._count]))

  const ROLE_TABS = [
    { label: "Todos",        value: ""             },
    { label: "Admins",       value: "ADMIN"        },
    { label: "Colaboradores",value: "COLLABORATOR" },
    { label: "Professores",  value: "TEACHER"      },
    { label: "Alunos",       value: "STUDENT"      },
    { label: "Responsáveis", value: "GUARDIAN"     },
  ]

  return (
    <div>
      <PageHeader title="USUÁRIOS" description="Gerencie todos os usuários do sistema">
        <LinkButton href="/admin/usuarios/novo">
          <UserPlus className="w-4 h-4 mr-2" /> Novo Usuário
        </LinkButton>
      </PageHeader>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(success)}
        </div>
      )}

      {/* Filtros de role */}
      <div className="flex gap-2 flex-wrap mb-4">
        {ROLE_TABS.map(({ label, value }) => (
          <Link key={value} href={`/admin/usuarios${value ? `?role=${value}` : ""}`}>
            <Badge
              variant={role === value || (!role && !value) ? "default" : "outline"}
              className="cursor-pointer px-3 py-1 text-xs"
            >
              {label} {value ? `(${countMap[value] ?? 0})` : `(${users.length})`}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Busca */}
      <form className="mb-4 flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            name="q" defaultValue={q}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9 h-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">Buscar</Button>
      </form>

      {/* Tabela */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-sub font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-sub font-semibold text-muted-foreground hidden md:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 font-sub font-semibold text-muted-foreground">Perfil</th>
                <th className="text-left px-4 py-3 font-sub font-semibold text-muted-foreground hidden lg:table-cell">Cadastro</th>
                <th className="text-center px-4 py-3 font-sub font-semibold text-muted-foreground">Ativo</th>
                <th className="text-right px-4 py-3 font-sub font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {format(user.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ToggleActiveButton id={user.id} active={user.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LinkButton href={`/admin/usuarios/${user.id}`} variant="ghost" size="icon">
                        <Pencil className="w-4 h-4" />
                      </LinkButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
