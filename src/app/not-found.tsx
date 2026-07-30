import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Compass className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="font-heading text-2xl">Página não encontrada</h1>
        <p className="text-muted-foreground text-sm">
          O endereço que você abriu não existe ou foi movido. Isso pode acontecer
          com um link antigo ou salvo nos favoritos.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button>Ir para o início</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
