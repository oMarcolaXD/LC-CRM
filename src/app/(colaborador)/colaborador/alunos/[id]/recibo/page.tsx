import { prisma }      from "@/lib/prisma"
import { notFound }    from "next/navigation"
import { PrintTrigger } from "./print-trigger"
import Link            from "next/link"
import Image           from "next/image"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { format }      from "date-fns"
import { ptBR }        from "date-fns/locale"
import { buttonVariants } from "@/components/ui/button"

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{
    paymentId?: string
    cpf?:       string
    name?:      string
    date?:      string
    desc?:      string
  }>
}

export default async function ReciboPage({ params, searchParams }: Props) {
  const { id }                            = await params
  const { paymentId, cpf, name, date, desc } = await searchParams

  if (!paymentId || !cpf || !name) notFound()

  const payment = await prisma.payment.findUnique({
    where:   { id: paymentId },
    include: {
      student: {
        include: {
          guardian: { include: { user: true } },
        },
      },
    },
  })

  if (!payment) notFound()

  const amount   = brl(Number(payment.amount))
  const dateStr  = date
    ? format(new Date(date), "dd/MM/yyyy", { locale: ptBR })
    : format(payment.paidAt ?? payment.dueDate, "dd/MM/yyyy", { locale: ptBR })

  const description = desc || "Aulas particulares"

  const guardianPhone = payment.student?.guardian?.user?.phone?.replace(/\D/g, "") ?? null
  const guardianName  = name

  const whatsappMsg = encodeURIComponent(
    `Olá ${guardianName}, segue o recibo de pagamento de ${amount} referente ao dia ${dateStr}. 📚`
  )
  const whatsappUrl = guardianPhone
    ? `https://wa.me/55${guardianPhone}?text=${whatsappMsg}`
    : null

  return (
    <>
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .print-page {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @page { size: A4 portrait; margin: 12mm; }
      `}</style>

      {/* Barra de ações */}
      <div className="print-hide flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link
          href={`/colaborador/alunos/${id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao aluno
        </Link>
        <div className="flex items-center gap-2">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <MessageCircle className="w-4 h-4 mr-2 text-[#25D366]" />
              Enviar WhatsApp
            </a>
          ) : (
            <button
              disabled
              title="Sem telefone do responsável"
              className={buttonVariants({ variant: "outline" }) + " opacity-50 cursor-not-allowed"}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar WhatsApp
            </button>
          )}
          <PrintTrigger />
        </div>
      </div>

      {/* Recibo */}
      <div className="print-page max-w-140 mx-auto bg-white rounded-xl shadow-md border border-border overflow-hidden">

        {/* Cabeçalho com logo + título */}
        <div className="bg-brand-orange flex flex-col items-center justify-center gap-3 px-8 py-5">
          <div className="rounded-2xl overflow-hidden shadow-md">
            <Image src="/logo.svg" alt="Lição de Casa" width={72} height={72} priority />
          </div>
          <h1 className="text-white font-heading text-2xl tracking-wider">RECIBO DE PAGAMENTO</h1>
        </div>

        {/* Dados do contratante + data + valor */}
        <div className="grid grid-cols-2 gap-6 px-8 py-6">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Dados do Contratante:
            </p>
            <p className="font-bold text-base leading-tight">{guardianName}</p>
            <p className="text-sm text-gray-600 mt-1">CPF: {cpf}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 mb-1">Data:</p>
              <div className="border border-gray-300 rounded-xl px-4 py-1.5 text-sm font-medium text-center min-w-27.5">
                {dateStr}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 mb-1">Valor do Serviço</p>
              <div className="bg-brand-blue text-white rounded-xl px-4 py-1.5 text-sm font-bold text-center min-w-27.5">
                {amount}
              </div>
            </div>
          </div>
        </div>

        {/* Seção de descrição */}
        <div className="px-8 pb-6">
          <div className="bg-brand-blue text-white text-center py-2 text-xs font-bold tracking-widest rounded-t-lg">
            DESCRIÇÃO DOS SERVIÇOS PRESTADOS
          </div>
          <div className="border-2 border-brand-blue rounded-b-lg px-5 py-5 min-h-27.5">
            <p className="text-sm text-gray-700">{description}</p>
          </div>
        </div>

        {/* Dados do prestador */}
        <div className="px-8 pb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            Dados do Prestador de Serviços:
          </p>
          <div className="space-y-0.5 text-sm">
            <p className="font-bold">Lição de Casa Serviços de Ensino Ltda</p>
            <p className="text-gray-600">CNPJ: 32.683.554/0001-27</p>
            <p className="text-gray-600">Rua Icaraí 317, Vila Jardini - Sorocaba - SP</p>
            <p className="text-gray-600">(15) 99627-9639</p>
            <p className="text-gray-600">espacolicao@gmail.com</p>
          </div>
        </div>

        {/* Linha pontilhada */}
        <div className="border-t-2 border-dotted border-gray-300 mx-6 mb-4" />
        <div className="h-4" />
      </div>
    </>
  )
}
