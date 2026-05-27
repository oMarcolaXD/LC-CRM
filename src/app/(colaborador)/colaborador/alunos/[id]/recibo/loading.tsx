import Image from "next/image"

export default function ReciboLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background px-4">

      {/* Logo animado */}
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <Image src="/logo.svg" alt="Lição de Casa" width={80} height={80} priority />
        </div>
        <div className="text-center space-y-1">
          <p className="font-sub text-base font-semibold text-foreground">Gerando recibo...</p>
          <p className="text-sm text-muted-foreground">Aguarde um momento</p>
        </div>
      </div>

      {/* Skeleton do recibo */}
      <div className="w-full max-w-140 rounded-xl border border-border overflow-hidden shadow-md">

        {/* Header skeleton */}
        <div className="bg-brand-orange/20 flex flex-col items-center gap-3 px-8 py-5">
          <div className="w-18 h-18 rounded-2xl bg-brand-orange/30 animate-pulse" />
          <div className="h-5 w-48 rounded bg-brand-orange/30 animate-pulse" />
        </div>

        {/* Dados skeleton */}
        <div className="grid grid-cols-2 gap-6 px-8 py-6">
          <div className="space-y-2">
            <div className="h-2.5 w-28 rounded bg-muted animate-pulse" />
            <div className="h-5 w-44 rounded bg-muted animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="h-9 w-28 rounded-xl bg-muted animate-pulse" />
            <div className="h-9 w-28 rounded-xl bg-brand-blue/20 animate-pulse" />
          </div>
        </div>

        {/* Descrição skeleton */}
        <div className="px-8 pb-6 space-y-0">
          <div className="h-8 rounded-t-lg bg-brand-blue/20 animate-pulse" />
          <div className="border-2 border-muted rounded-b-lg px-5 py-5 min-h-27.5 space-y-2">
            <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>

        {/* Prestador skeleton */}
        <div className="px-8 pb-8 space-y-2">
          <div className="h-2.5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-56 rounded bg-muted animate-pulse" />
          <div className="h-3 w-44 rounded bg-muted animate-pulse" />
          <div className="h-3 w-52 rounded bg-muted animate-pulse" />
        </div>

        <div className="border-t-2 border-dotted border-muted mx-6 mb-4" />
        <div className="h-4" />
      </div>
    </div>
  )
}
