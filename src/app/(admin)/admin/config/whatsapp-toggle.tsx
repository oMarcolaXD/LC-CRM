"use client"

import { useTransition } from "react"
import { Switch }        from "@/components/ui/switch"
import { setWhatsAppEnabledAction } from "@/lib/actions/config"

export function WhatsAppToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Switch
      checked={enabled}
      disabled={pending}
      onCheckedChange={(val) =>
        startTransition(() => setWhatsAppEnabledAction(val))
      }
    />
  )
}
