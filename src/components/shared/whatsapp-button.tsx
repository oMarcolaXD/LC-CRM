"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageCircle, X } from "lucide-react"

const WHATSAPP_NUMBER = "5515996279639"
const DEFAULT_MESSAGE = "Olá! Preciso de ajuda com o sistema Lição de Casa. 📚"

const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`

export function WhatsAppButton() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1">
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Suporte via WhatsApp"
        className="
          flex items-center gap-2.5
          p-3.5 md:pl-4 md:pr-5 md:py-3 rounded-full
          bg-[#25D366] text-white shadow-lg
          hover:bg-[#1ebe5d] hover:scale-105
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2
        "
      >
        <MessageCircle className="w-6 h-6 md:w-5 md:h-5 fill-white stroke-none shrink-0" />
        <span className="hidden md:block text-sm font-semibold leading-tight">
          Preciso de ajuda
        </span>
      </Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Fechar"
        className="
          w-5 h-5 rounded-full bg-black/40 text-white
          flex items-center justify-center
          hover:bg-black/60 transition-colors
          -ml-3 -mt-6 self-start
        "
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
