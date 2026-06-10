"use client"

import { useState, useTransition } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import { saveMessageTemplateAction, resetMessageTemplateAction } from "@/lib/actions/config"
import { RotateCcw, Save } from "lucide-react"
import type { MessageTemplateDef } from "@/lib/notifications/templates"

export function TemplateEditor({ def, value }: { def: MessageTemplateDef; value: string }) {
  const [text, setText]       = useState(value)
  const [pending, startTransition] = useTransition()
  const isCustom = text !== def.default

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="font-mono text-sm"
      />

      <div className="flex flex-wrap gap-1.5">
        {def.variables.map((v) => (
          <Badge key={v} variant="secondary" className="font-mono text-[11px]">
            {`{{${v}}}`}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <form
          action={(formData) => startTransition(() => saveMessageTemplateAction(formData))}
        >
          <input type="hidden" name="template_id" value={def.id} />
          <input type="hidden" name="template_value" value={text} />
          <Button type="submit" size="sm" disabled={pending}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Salvar
          </Button>
        </form>

        <form
          action={(formData) =>
            startTransition(() => {
              setText(def.default)
              return resetMessageTemplateAction(formData)
            })
          }
        >
          <input type="hidden" name="template_id" value={def.id} />
          <Button type="submit" size="sm" variant="outline" disabled={pending || !isCustom}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Restaurar padrão
          </Button>
        </form>
      </div>
    </div>
  )
}
