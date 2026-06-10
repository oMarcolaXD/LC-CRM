import Link                  from "next/link"
import { PageHeader }         from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { buttonVariants }     from "@/components/ui/button"
import { MESSAGE_TEMPLATES, getAllMessageTemplates } from "@/lib/notifications/templates"
import { TemplateEditor }     from "./template-editor"
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react"

interface MensagensPageProps {
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function MensagensConfigPage({ searchParams }: MensagensPageProps) {
  const [templates, { error, success }] = await Promise.all([
    getAllMessageTemplates(),
    searchParams,
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/config" className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <PageHeader
          title="MENSAGENS PADRÃO"
          description="Textos enviados por WhatsApp, e-mail e notificações no app"
        />
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {decodeURIComponent(success)}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MESSAGE_TEMPLATES.map((def) => (
          <Card key={def.id}>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-base">{def.label}</CardTitle>
              <CardDescription className="text-xs">{def.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateEditor def={def} value={templates[def.id]} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
