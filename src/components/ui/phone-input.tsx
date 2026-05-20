"use client"

import { useState, forwardRef } from "react"
import { Input } from "@/components/ui/input"
import type { InputHTMLAttributes } from "react"

function formatPhone(digits: string): string {
  if (digits.length <= 10) {
    // (XX) XXXX-XXXX
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }
  // (XX) XXXXX-XXXX
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string
  onChange?: (raw: string) => void
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, name, ...props }, ref) => {
    const [display, setDisplay] = useState(() => {
      const digits = value.replace(/\D/g, "").slice(0, 11)
      return digits ? formatPhone(digits) : ""
    })

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 11)
      const formatted = digits ? formatPhone(digits) : ""
      setDisplay(formatted)
      onChange?.(digits)
    }

    return (
      <>
        <input type="hidden" name={name} value={display.replace(/\D/g, "")} />
        <Input
          ref={ref}
          {...props}
          name={undefined}
          value={display}
          onChange={handleChange}
          placeholder="(11) 99999-9999"
          inputMode="numeric"
        />
      </>
    )
  }
)
PhoneInput.displayName = "PhoneInput"
