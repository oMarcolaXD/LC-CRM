import { auth }          from "@/lib/auth"
import { prisma }        from "@/lib/prisma"
import { Button }        from "@/components/ui/button"
import { Input }         from "@/components/ui/input"
import { Card }          from "@/components/ui/card"
import { PageHeader }    from "@/components/shared/page-header"
import { RoleBadge }     from "@/components/shared/role-badge"
import { LinkButton }    from "@/components/shared/link-button"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import { DeleteUserButton }   from "./delete-user-button"
import { UserRoleTabs }       from "./user-role-tabs"
import { UserPlus, Pencil, Search, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react"
import { format }        from "date-fns"
import { ptBR }          from "date-fns/locale"
import { Suspense }      from "react"
import type { Role }     from "@prisma/client"

const ROLE_FILTER: Record<string, Role | undefined> = {
  ADMIN: "ADMIN", COLLABORATOR: "COLLABORATOR",
  TEACHER: "TEACHER", STUDENT: "STUDENT", GUARDIAN: "GUARDIAN",
}

const PAGE_SIZE = 20

interface UsuariosPageProps {
  searchParams: Promise<{ q?: string; role?: string; page?: string; success?: string; error?: string }>
}

function buildQuery(opts: { q?: string; role?: string; page?: number }) {
  const p = new URLSearchParams()
  if (opts.role) p.set("role", opts.role)
  if (opts.q)   p.set("q", opts.q)
  if (opts.page && opts.page > 1) p.set("page", String(opts.page))
  return p.toString()
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const { q, role, page: pageParam, success, error } = await searchParams
  const session    = await auth()
  const currentId  = session?.user?.id ?? ""
  const roleFilter = role ? ROLE_FILTER[role] : undefined
  const page       = Math.max(1, parseInt(pageParam ?? "1", 10))
  const skip       = (page - 1) * PAGE_SIZE

  const where = {
    ...(roleFilter && { role: roleFilter }),
    ...(q && {
      OR: [
        { name:  { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  }

  const [users, counts, filteredCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where }),
  ])

  const countMap   = Object.fromEntries(counts.map((c) => [c.role, c._count]))
  const total      = counts.reduce((sum, c) => sum + c._count, 0)
  const totalPages = Math.ceil(filteredCount / PAGE_SIZE)

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
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Filtros de role — tabs */}
      <Suspense>
        <UserRoleTabs counts={countMap} total={total} />
      </Suspense>

      {/* Busca */}
      <form className="mb-4 flex gap-2 max-w-sm">
        {role && <input type="hidden" name="role" value={role} />}
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
                users.map((user) => {
                  const isProtectedAdmin = user.role === "ADMIN" && user.id !== currentId
                  return (
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
                        {isProtectedAdmin
                          ? <ShieldAlert className="w-4 h-4 text-muted-foreground mx-auto" aria-label="Conta protegida" />
                          : <ToggleActiveButton id={user.id} active={user.active} />
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isProtectedAdmin ? (
                          <span className="text-xs text-muted-foreground px-2">Protegido</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <LinkButton href={`/admin/usuarios/${user.id}`} variant="ghost" size="icon">
                              <Pencil className="w-4 h-4" />
                            </LinkButton>
                            <DeleteUserButton id={user.id} name={user.name} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
          <span>
            {filteredCount === 0
              ? "Nenhum usuário"
              : `${skip + 1}–${Math.min(skip + PAGE_SIZE, filteredCount)} de ${filteredCount} usuário${filteredCount !== 1 ? "s" : ""}`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {page > 1 ? (
                <LinkButton
                  href={`/admin/usuarios?${buildQuery({ q, role, page: page - 1 })}`}
                  variant="outline" size="icon" className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </LinkButton>
              ) : (
                <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <span className="px-3 text-xs">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <LinkButton
                  href={`/admin/usuarios?${buildQuery({ q, role, page: page + 1 })}`}
                  variant="outline" size="icon" className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </LinkButton>
              ) : (
                <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
