"use client"

import Link                      from "next/link"
import { usePathname }           from "next/navigation"
import { useState }              from "react"
import { MoreHorizontal, LogOut, Sun, Moon } from "lucide-react"
import { cn }                    from "@/lib/utils"
import { useTheme }              from "next-themes"
import { signOut }               from "next-auth/react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { BOTTOM_NAV }            from "./bottom-nav-items"
import { NotificationBell }      from "./notification-bell"
import type { Role }             from "@prisma/client"

interface BottomNavProps {
  role: Role
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname  = usePathname()
  const [open, setOpen] = useState(false)
  const config    = BOTTOM_NAV[role]
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  function isActive(href: string, matchPrefix?: string) {
    if (matchPrefix) return pathname.startsWith(matchPrefix)
    return pathname === href
  }

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 items-stretch">
          {/* Primary tabs */}
          {config.primary.map((item) => {
            const active = isActive(item.href, item.matchPrefix)
            const Icon   = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}

          {/* "Mais" tab */}
          {config.overflow.length > 0 && (
            <button
              onClick={() => setOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-[3px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">Mais</span>
            </button>
          )}
        </div>
      </nav>

      {/* Overflow sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-[14px] px-0 pb-0">
          <SheetHeader className="px-5 pb-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-[15px]">Menu</SheetTitle>
              <NotificationBell />
            </div>
          </SheetHeader>

          <nav className="flex flex-col">
            {config.overflow.map((item) => {
              const active = isActive(item.href, item.matchPrefix)
              const Icon   = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-[13px] text-[14px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                  {item.label}
                </Link>
              )
            })}

            <div className="mx-5 my-2 border-t border-border" />

            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex items-center gap-3 px-5 py-[13px] text-[14px] font-medium text-foreground hover:bg-accent transition-colors"
            >
              {isDark
                ? <Sun  className="h-[18px] w-[18px] shrink-0 text-yellow-400" />
                : <Moon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
              }
              {isDark ? "Tema claro" : "Tema escuro"}
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 px-5 py-[13px] pb-[calc(13px+env(safe-area-inset-bottom))] text-[14px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              Sair
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
