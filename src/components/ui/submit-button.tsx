"use client"

import { useFormStatus }             from "react-dom"
import { Button, buttonVariants }    from "./button"
import type { VariantProps }         from "class-variance-authority"
import type { Button as BtnPrimitive } from "@base-ui/react/button"

type SubmitButtonProps =
  Omit<BtnPrimitive.Props, "type"> &
  VariantProps<typeof buttonVariants>

export function SubmitButton({ children, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} disabled={disabled} {...props}>
      {children}
    </Button>
  )
}
