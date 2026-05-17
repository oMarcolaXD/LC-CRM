"use client"

import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const WHATSAPP_NUMBER = "5515996279639"
const DEFAULT_MESSAGE = "Olá! Preciso de ajuda com o sistema Lição de Casa. 📚"

const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`

export function WhatsAppButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Suporte via WhatsApp"
          className="
            fixed bottom-6 right-6 z-50
            flex items-center justify-center
            w-14 h-14 rounded-full
            bg-[#25D366] text-white shadow-lg
            hover:bg-[#1ebe5d] hover:scale-110
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2
          "
        >
          <MessageCircle className="w-7 h-7 fill-white stroke-none" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="left">Suporte via WhatsApp</TooltipContent>
    </Tooltip>
  )
}
