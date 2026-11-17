"use client"

import { useActionState } from "react"
import { UserForm }        from "../user-form"
import { createUserAction } from "../actions"

interface CreateUserFormProps {
  guardians:      { id: string; name: string; phone?: string | null; students?: string[] }[]
  students:       { id: string; name: string; grade: string }[]
  canCreateAdmin?: boolean
}

export function CreateUserForm({ guardians, students, canCreateAdmin = true }: CreateUserFormProps) {
  const [state, formAction] = useActionState(createUserAction, null)

  return (
    <UserForm
      action={formAction}
      error={state?.error}
      guardians={guardians}
      students={students}
      canCreateAdmin={canCreateAdmin}
    />
  )
}
