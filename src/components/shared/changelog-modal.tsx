"use client"

import { useState, useEffect }   from "react"
import { markChangelogSeen }     from "@/lib/actions/changelog"
import { changelog, CURRENT_VERSION } from "@/data/changelog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button }        from "@/components/ui/button"
import { Badge }         from "@/components/ui/badge"
import { CheckCircle2, Sparkles } from "lucide-react"
import type { Role }     from "@prisma/client"

const SESSION_KEY = `changelog_seen_${CURRENT_VERSION}`

interface ChangelogModalProps {
  shouldShow:      boolean
  userRole:        Role
  lastSeenVersion: string | null
}

export function ChangelogModal({ shouldShow, userRole, lastSeenVersion }: ChangelogModalProps) {
  const [open, setOpen] = useState(false)

  // Abre somente se: versão não foi suprimida no banco E ainda não foi visto nesta sessão
  useEffect(() => {
    if (!shouldShow) return
    if (sessionStorage.getItem(SESSION_KEY)) return
    setOpen(true)
  }, [shouldShow])

  const visibleEntries = changelog.filter((entry) => {
    const isRelevantRole = entry.roles.includes(userRole as "ADMIN" | "COLLABORATOR" | "TEACHER")
    const isNewVersion   = !lastSeenVersion || entry.version > lastSeenVersion
    return isRelevantRole && isNewVersion
  })

  if (!open) return null

  function handleDismiss() {
    sessionStorage.setItem(SESSION_KEY, "1")
    setOpen(false)
  }

  async function handleNeverShowAgain() {
    sessionStorage.setItem(SESSION_KEY, "1")
    setOpen(false)
    await markChangelogSeen()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="font-heading text-xl">Novidades do Sistema</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1 pr-1">
          {visibleEntries.map((entry) => (
            <div key={entry.version} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                  v{entry.version}
                </Badge>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <p className="font-sub font-semibold text-sm">{entry.title}</p>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2 border-t flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleNeverShowAgain}
            className="w-full sm:w-auto text-muted-foreground text-sm"
          >
            Não mostrar novamente
          </Button>
          <Button onClick={handleDismiss} className="w-full sm:w-auto font-sub font-semibold">
            Entendi!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
