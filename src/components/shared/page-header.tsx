import { LinkButton } from "./link-button"
import { ArrowLeft }  from "lucide-react"

interface PageHeaderProps {
  title:        string
  description?: string
  backHref?:    string
  children?:    React.ReactNode
}

export function PageHeader({ title, description, backHref, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {backHref && (
          <LinkButton href={backHref} variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </LinkButton>
        )}
        <div>
          <h1 className="font-heading text-2xl text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
