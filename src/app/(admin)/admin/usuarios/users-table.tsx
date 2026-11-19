"use client"

import { useState, useTransition } from "react"
import { Checkbox }        from "@/components/ui/checkbox"
import { Button }          from "@/components/ui/button"
import { RoleBadge }       from "@/components/shared/role-badge"
import { LinkButton }      from "@/components/shared/link-button"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import { DeleteUserButton }   from "./delete-user-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteManyUsersAction } from "./actions"
import { Pencil, ShieldAlert, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { ptBR }   from "date-fns/locale"

interface UserRow {
  id:        string
  name:      string | null
  email:     string | null
  role:      string
  active:    boolean
  createdAt: Date
}

interface UsersTableProps {
  users:     UserRow[]
  currentId: string
}

export function UsersTable({ users, currentId }: UsersTableProps) {
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [bulkError, setBulkError] = useState<string | null>(null)

  const selectable = users.filter(
    (u) => !(u.role === "ADMIN" && u.id !== currentId) && u.id !== currentId
  )
  const selectableIds = selectable.map((u) => u.id)
  const allChecked    = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const indeterminate = !allChecked && selectableIds.some((id) => selected.has(id))

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableIds))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function handleBulkDelete() {
    setBulkError(null)
    startTransition(async () => {
      const res = await deleteManyUsersAction(Array.from(selected))
      if ("deleted" in res) {
        setSelected(new Set())
      }
    })
  }

  const selectedCount = selected.size

  return (
    <>
      {/* Barra de seleção */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-muted/60 border border-border rounded-lg text-sm">
          <span className="text-muted-foreground flex-1">
            <span className="font-semibold text-foreground">{selectedCount}</span>{" "}
            usuário{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""}
          </span>

          {bulkError && (
            <span className="text-xs text-destructive">{bulkError}</span>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
          >
            Limpar seleção
          </Button>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5"
                  disabled={isPending}
                />
              }
            >
              {isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Trash2 className="w-3 h-3" />
              }
              {" "}Excluir selecionados
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selectedCount} usuário{selectedCount !== 1 ? "s" : ""}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível. Contas de administrador e a sua própria conta serão ignoradas automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 w-10">
                <Checkbox
                  checked={allChecked}
                  indeterminate={indeterminate}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                  disabled={selectableIds.length === 0}
                />
              </th>
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
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isProtectedAdmin = user.role === "ADMIN" && user.id !== currentId
                const isSelf           = user.id === currentId
                const isSelectable     = !isProtectedAdmin && !isSelf
                const isSelected       = selected.has(user.id)

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-border last:border-0 transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-4 py-3 w-10">
                      {isSelectable ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(user.id)}
                          aria-label={`Selecionar ${user.name}`}
                        />
                      ) : (
                        <Checkbox disabled aria-label="Não selecionável" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={user.role as never} /></td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {format(user.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* Outro admin pode ser suspenso (ex.: saiu da empresa); só a
                          própria conta não — ninguém se tranca para fora. */}
                      {isSelf
                        ? <span title="Você não pode suspender a sua própria conta"><ShieldAlert className="w-4 h-4 text-muted-foreground mx-auto" aria-label="Sua conta" /></span>
                        : <ToggleActiveButton id={user.id} active={user.active} name={user.name ?? undefined} />
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isProtectedAdmin ? (
                        // Admin não é excluído (perderia o histórico) — suspende e/ou rebaixa
                        <LinkButton href={`/admin/usuarios/${user.id}`} variant="ghost" size="icon">
                          <Pencil className="w-4 h-4" />
                        </LinkButton>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <LinkButton href={`/admin/usuarios/${user.id}`} variant="ghost" size="icon">
                            <Pencil className="w-4 h-4" />
                          </LinkButton>
                          <DeleteUserButton id={user.id} name={user.name ?? ""} />
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
    </>
  )
}
