"use client"

import { useState, useEffect, useTransition } from "react"
import { Bell }    from "lucide-react"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { formatDistanceToNow } from "date-fns"
import { ptBR }    from "date-fns/locale"

interface Notification {
  id:        string
  type:      string
  title:     string
  message:   string
  read:      boolean
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  LESSON_REQUEST:       "📅",
  LESSON_CONFIRMED:     "✅",
  LESSON_CANCELLED:     "❌",
  LESSON_COMPLETED:     "🎓",
  LESSON_REMINDER_24H:  "⏰",
  LESSON_REMINDER_1H:   "🔔",
  LESSON_MISSED:        "😔",
  HOMEWORK_ASSIGNED:    "📝",
  MATERIAL_UPLOADED:    "📚",
  PACKAGE_LOW_BALANCE:  "⚠️",
  PAYMENT_DUE:          "💰",
  PAYMENT_OVERDUE:      "🚨",
  PAYOUT_GENERATED:     "💵",
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread,        setUnread]        = useState(0)
  const [open,          setOpen]          = useState(false)
  const [pending,       start]            = useTransition()

  const load = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => { setNotifications(d.notifications ?? []); setUnread(d.unread ?? 0) })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)  // atualiza a cada 30s
    return () => clearInterval(interval)
  }, [])

  const markRead = () => {
    if (unread === 0) return
    start(async () => {
      await fetch("/api/notifications", { method: "PATCH" })
      setUnread(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    })
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) { load(); markRead() } }}>
      <PopoverTrigger className="relative inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors outline-none">
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-sub font-semibold text-sm">Notificações</h3>
          {unread > 0 && (
            <button onClick={markRead} className="text-xs text-primary hover:underline" disabled={pending}>
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${n.read ? "" : "bg-primary/5"}`}>
                <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-tight ${n.read ? "text-foreground" : "font-semibold text-foreground"}`}>
                      {n.title}
                    </p>
                    {!n.read && <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
