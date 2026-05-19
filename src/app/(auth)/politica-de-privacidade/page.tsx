import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Política de Privacidade — Lição de Casa CRM",
}

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Image src="/logo.svg" alt="Lição de Casa" width={120} height={40} />
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>

        {/* Content */}
        <article className="prose prose-sm max-w-none text-foreground">
          <h1 className="font-heading text-3xl text-foreground mb-2">Política de Privacidade</h1>
          <p className="text-xs text-muted-foreground mb-8">Efetiva a partir de 18 de maio de 2026</p>

          <p>
            A sua privacidade é importante para nós. É política do <strong>Lição de Casa CRM</strong> respeitar
            a sua privacidade em relação a qualquer informação sua que possamos coletar no sistema.
          </p>

          <p>
            Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço.
            Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que
            estamos coletando e como será usado.
          </p>

          <p>
            Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado.
            Quando armazenamos dados, protegemos dentro de meios comercialmente aceitáveis para evitar perdas e
            roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.
          </p>

          <p>
            Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando
            exigido por lei.
          </p>

          <p>
            Você é livre para recusar a nossa solicitação de informações pessoais, entendendo que talvez não
            possamos fornecer alguns dos serviços desejados.
          </p>

          <p>
            O uso continuado do sistema será considerado como aceitação de nossas práticas em torno de privacidade
            e informações pessoais. Se você tiver alguma dúvida sobre como lidamos com dados do usuário e
            informações pessoais, entre em contacto conosco.
          </p>

          <h2 className="font-sub text-xl font-bold mt-8 mb-3">Compromisso do Usuário</h2>

          <p>
            O usuário se compromete a fazer uso adequado dos conteúdos e da informação que o Lição de Casa CRM
            oferece no sistema e, com caráter enunciativo mas não limitativo:
          </p>

          <ul className="space-y-2 list-none pl-0">
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">A)</span>
              <span>
                Não se envolver em atividades que sejam ilegais ou contrárias à boa fé e à ordem pública.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">B)</span>
              <span>
                Não difundir propaganda ou conteúdo de natureza racista, xenofóbica, qualquer tipo de pornografia
                ilegal, de apologia ao terrorismo ou contra os direitos humanos.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">C)</span>
              <span>
                Não causar danos aos sistemas físicos (hardwares) e lógicos (softwares) do Lição de Casa CRM,
                de seus fornecedores ou terceiros, para introduzir ou disseminar vírus informáticos ou quaisquer
                outros sistemas de hardware ou software que sejam capazes de causar danos anteriormente mencionados.
              </span>
            </li>
          </ul>

          <h2 className="font-sub text-xl font-bold mt-8 mb-3">Mais Informações</h2>

          <p>
            Se houver algo que você não tem certeza ou precisar de esclarecimentos, não hesite em entrar em contato
            conosco pelo WhatsApp{" "}
            <a href="https://wa.me/5515996279639" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              (15) 99627-9639
            </a>{" "}
            ou pelo e-mail{" "}
            <a href="mailto:espacolicao@gmail.com" className="text-primary hover:underline">
              espacolicao@gmail.com
            </a>.
          </p>

          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Lição de Casa CRM © 2026 — Todos os direitos reservados.
            </p>
          </div>
        </article>

      </div>
    </div>
  )
}
