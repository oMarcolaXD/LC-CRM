import Link            from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn }          from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

type LinkButtonProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>

export function LinkButton({ variant, size, className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  )
}
