"use client"

import { useActionState, useTransition, useState } from "react"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { createSubjectAction, updateSubjectAction, deleteSubjectAction } from "@/lib/actions/subjects"
import { BookOpen, Plus, Pencil, Trash2, X, Check, Loader2, AlertCircle } from "lucide-react"
import type { Subject } from "@prisma/client"

// ─── Formulário de criação ────────────────────────────────────────────────────

function CreateForm() {
  const [state, action, pending] = useActionState(createSubjectAction, null)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-full mt-2">
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Nova matéria
      </Button>
    )
  }

  return (
    <form action={async (fd) => { await action(fd); if (!state?.error) setOpen(false) }} className="mt-2 space-y-2 p-3 rounded-lg border bg-muted/30">
      {state?.error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{state.error}
        </p>
      )}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-name" className="text-xs">Nome *</Label>
          <Input id="new-name" name="name" placeholder="Ex: Matemática" className="h-8 text-sm" required />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X className="w-3.5 h-3.5 mr-1" />Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          Salvar
        </Button>
      </div>
    </form>
  )
}

// ─── Linha de matéria (visualização + edição inline) ─────────────────────────

function SubjectRow({ subject }: { subject: Subject }) {
  const [editing, setEditing] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePending, startDelete] = useTransition()

  const boundUpdate = updateSubjectAction.bind(null, subject.id)
  const [editState, editAction, editPending] = useActionState(boundUpdate, null)

  function handleDelete() {
    setDeleteError(null)
    startDelete(async () => {
      const res = await deleteSubjectAction(subject.id)
      if (res.error) setDeleteError(res.error)
    })
  }

  if (editing) {
    return (
      <li className="rounded-lg border bg-muted/30 p-3 space-y-2">
        {editState?.error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{editState.error}
          </p>
        )}
        <form action={async (fd) => { await editAction(fd); setEditing(false) }} className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input name="name" defaultValue={subject.name} className="h-8 text-sm" required />
          </div>
          <div className="flex items-end gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
            <Button type="submit" size="icon" className="h-8 w-8" disabled={editPending}>
              {editPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-muted/40 group">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{subject.name}</span>
        {subject.level && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {subject.level}
          </span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {deleteError && (
          <span className="text-xs text-destructive mr-1">{deleteError}</span>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          size="icon" variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={deletePending}
          onClick={handleDelete}
        >
          {deletePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </Button>
      </div>
    </li>
  )
}

// ─── Card principal ───────────────────────────────────────────────────────────

export function SubjectManager({ subjects }: { subjects: Subject[] }) {
  return (
    <div className="space-y-1">
      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma matéria cadastrada</p>
      ) : (
        <ul className="divide-y divide-border/50 max-h-80 overflow-y-auto pr-1">
          {subjects.map((s) => <SubjectRow key={s.id} subject={s} />)}
        </ul>
      )}
      <CreateForm />
    </div>
  )
}
