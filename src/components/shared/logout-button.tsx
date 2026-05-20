"use client"

import { signOut }   from "next-auth/react"
import { useState }  from "react"
import { Button }    from "@/components/ui/button"
import { LogOut }    from "lucide-react"

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={() => { setLoading(true); signOut({ callbackUrl: "/login" }) }}
      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
    >
      {!loading && <LogOut className="w-4 h-4" />}
      <span className="hidden sm:inline">{loading ? "Saindo..." : "Sair"}</span>
    </Button>
  )
}
