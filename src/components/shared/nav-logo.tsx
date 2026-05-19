"use client"

import Image from "next/image"
import Link  from "next/link"
import { useRef, useState } from "react"

export function NavLogo({ collapsed = false }: { collapsed?: boolean }) {
  const countRef  = useRef(0)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pulse, setPulse] = useState(false)

  function handleIconClick() {
    // Feedback visual a cada clique
    setPulse(true)
    setTimeout(() => setPulse(false), 150)

    countRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { countRef.current = 0 }, 3000)

    if (countRef.current >= 5) {
      countRef.current = 0
      window.dispatchEvent(new Event("lua:appear"))
    }
  }

  return (
    <div className="flex items-center gap-3 px-2 py-1 select-none">
      <button
        type="button"
        onClick={handleIconClick}
        className="w-9 h-9 shrink-0 rounded-full overflow-hidden shadow-sm focus:outline-none"
        style={{ transform: pulse ? "scale(0.88)" : "scale(1)", transition: "transform 0.15s ease" }}
      >
        <Image src="/logo.svg" alt="Lição de Casa" width={36} height={36} priority />
      </button>
      {!collapsed && (
        <Link href="/" className="font-heading text-lg text-foreground leading-none hover:opacity-80 transition-opacity">
          LIÇÃO DE CASA
        </Link>
      )}
    </div>
  )
}
