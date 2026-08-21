import { Suspense } from "react"
import { PeriodFilter } from "./period-filter"
import { ReportTabs } from "./report-tabs"
import { ReportActions } from "./report-actions"

// O cabeçalho, o filtro de período e as abas são comuns a todas as sub-rotas.
// Layouts do App Router não recebem searchParams — por isso PeriodFilter,
// ReportTabs e ReportActions são client components que leem a URL com
// useSearchParams (e ficam dentro de <Suspense>, exigência do hook).

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      {/*
        Impressão (= "Salvar como PDF" do navegador). Mesmo padrão do recibo do
        colaborador, com um acréscimo essencial: o shell do app é `h-screen
        overflow-hidden`, o que faria a impressão parar na primeira página.
        Por isso os `overflow: visible` — sem eles só sai o que cabe na tela.
        Paisagem porque o quadro do DRE tem uma coluna por mês.
      */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          header, aside, nav, [data-sidebar] { display: none !important; }
          main { overflow: visible !important; padding: 0 !important; }
          main [class*="overflow"] { overflow: visible !important; }
          .recharts-wrapper, table { break-inside: avoid; }
          a[href]::after { content: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl text-foreground">RELATÓRIOS</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Como a empresa está ganhando e gastando dinheiro
            </p>
          </div>
          <Suspense fallback={null}>
            <ReportActions />
          </Suspense>
        </div>

        <Suspense fallback={<div className="h-[34px]" />}>
          <PeriodFilter />
        </Suspense>

        <div className="border-b border-border">
          <Suspense fallback={<div className="h-[37px]" />}>
            <ReportTabs />
          </Suspense>
        </div>
      </div>

      {children}
    </div>
  )
}
