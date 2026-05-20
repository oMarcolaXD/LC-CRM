"use client"

import { useEffect, useState } from "react"

const KONAMI = [
  "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
  "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight",
  "b","a",
]

export function EasterEggLua() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState("A guardiã secreta do sistema.")
  const [walking, setWalking] = useState(false)
  const [sequence, setSequence] = useState<string[]>([])

  // Console easter egg — roda uma vez
  useEffect(() => {
    console.log(
      "%c /\\_/\\ \n( ^.^ )\n > 🌙 <",
      "color:#FB8500;font-size:16px;font-family:monospace;line-height:1.6"
    )
    console.log(
      "%cOlá, dev curioso! Você encontrou a Lua — a guardiã secreta do Lição de Casa CRM. 🐱",
      "color:#219EBC;font-weight:bold;font-size:13px"
    )
  }, [])

  function show(msg: string) {
    setMessage(msg)
    setVisible(true)
  }

  // Konami Code
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      setSequence(prev => {
        const next = [...prev, e.key].slice(-KONAMI.length)
        if (next.join(",") === KONAMI.join(",")) {
          show("A guardiã secreta do sistema.")
          return []
        }
        return next
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // 5 cliques no logo
  useEffect(() => {
    function onLogoClick() {
      show("Clicou 5x no logo? Você merece um miau! 🐾")
    }
    window.addEventListener("lua:appear", onLogoClick)
    return () => window.removeEventListener("lua:appear", onLogoClick)
  }, [])

  // Meia-noite — Lua atravessa a tela
  useEffect(() => {
    function checkMidnight() {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        setWalking(true)
        setTimeout(() => setWalking(false), 6000)
      }
    }
    const interval = setInterval(checkMidnight, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-dismiss popup
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 6000)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <>
      {/* Popup — Konami Code + 5 cliques */}
      {visible && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-end p-8 pointer-events-none" aria-hidden>
          <div
            className="pointer-events-auto flex flex-col items-center gap-3 cursor-pointer animate-in slide-in-from-bottom-8 fade-in duration-500"
            onClick={() => setVisible(false)}
          >
            <div className="bg-white rounded-2xl px-5 py-3 shadow-xl text-center relative">
              <p className="font-semibold text-[#023047] text-sm">Miau! Sou a Lua 🌙</p>
              <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
            </div>
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-2xl ring-2 ring-[#FB8500]/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lua.jpg" alt="Lua" className="w-full h-full object-cover object-center" />
            </div>
          </div>
        </div>
      )}

      {/* Walker de meia-noite */}
      {walking && (
        <div
          className="fixed bottom-6 z-[9999] pointer-events-none"
          style={{ animation: "lua-walk 6s linear forwards" }}
          aria-hidden
        >
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs bg-white rounded-full px-3 py-1 shadow-md text-[#023047] font-semibold whitespace-nowrap">
              Boa meia-noite! 🌙
            </p>
            <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white shadow-xl ring-2 ring-[#FB8500]/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lua.jpg" alt="Lua" className="w-full h-full object-cover object-center" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes lua-walk {
          from { left: -80px; }
          to   { left: 100vw; }
        }
      `}</style>
    </>
  )
}
