"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, Suspense } from "react"

function ProgressBarInner() {
  const pathname    = useSearchParams() // trigger re-render on any nav
  const currentPath = usePathname()
  const [visible,  setVisible]  = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPath = useRef(currentPath)

  // Navigation ended → hide bar
  useEffect(() => {
    if (prevPath.current !== currentPath) {
      prevPath.current = currentPath
      setProgress(100)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }
  }, [currentPath, pathname])

  // Listen for clicks on internal links → start bar immediately
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      // Skip external, hash-only, or same-page links
      if (href.startsWith("http") || href.startsWith("//") || href.startsWith("#")) return
      if (href === currentPath) return

      if (timerRef.current) clearTimeout(timerRef.current)
      setVisible(true)
      setProgress(20)
      timerRef.current = setTimeout(() => setProgress(60), 120)
      timerRef.current = setTimeout(() => setProgress(80), 400)
    }

    document.addEventListener("click", onLinkClick)
    return () => document.removeEventListener("click", onLinkClick)
  }, [currentPath])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full bg-primary transition-all ease-out"
        style={{ width: `${progress}%`, transitionDuration: progress === 100 ? "200ms" : "400ms" }}
      />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <Suspense>
      <ProgressBarInner />
    </Suspense>
  )
}
