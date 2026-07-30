import { FlaskConical } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import type { NotificationStatus } from "@/lib/notifications/status"

/**
 * Avisa que as confirmações não vão chegar a ninguém — antes do atendente
 * clicar em enviar. Sem interação: serve em server e client component.
 *
 * `silent` (nada sai por nenhum canal) é alerta de verdade; faltar um canal só
 * é informação. Ambiente de teste não é erro — leva ícone de frasco.
 */
export function NotificationConfigWarning({
  status,
  variant = "banner",
}: {
  status:   NotificationStatus
  variant?: "banner" | "inline"
}) {
  if (!status.aviso) return null

  return (
    <Alert
      tone={status.silent ? "warning" : "info"}
      dense={variant === "inline"}
      title={status.aviso}
      icon={status.devMode ? <FlaskConical className="h-[18px] w-[18px]" /> : undefined}
    >
      {status.comoResolver}
    </Alert>
  )
}
