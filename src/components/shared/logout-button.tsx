"use client"

import { signOut }  from "next-auth/react"
import { Button }   from "@/components/ui/button"
import { LogOut }   from "lucide-react"

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">Sair</span>
    </Button>
  )
}
