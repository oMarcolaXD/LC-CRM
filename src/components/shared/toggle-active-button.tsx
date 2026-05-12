"use client"

import { useTransition } from "react"
import { Switch }        from "@/components/ui/switch"
import { toggleUserActiveAction } from "@/app/(admin)/admin/usuarios/actions"

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Switch
      checked={active}
      disabled={pending}
      onCheckedChange={(val) =>
        startTransition(() => toggleUserActiveAction(id, val))
      }
    />
  )
}
