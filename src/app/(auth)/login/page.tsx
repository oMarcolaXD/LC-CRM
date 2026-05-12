import { LoginForm }    from "./login-form"
import { BookOpen, GraduationCap, Users, BarChart3 } from "lucide-react"

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex">
      {/* Painel esquerdo — identidade visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-gradient flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-15 -right-15 w-48 h-48 rounded-full bg-white/10" />

        <div className="relative z-10 text-center text-white mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-9 h-9 text-brand-orange" />
            </div>
          </div>
          <h1 className="font-heading text-5xl text-white mb-2">LIÇÃO DE CASA</h1>
          <p className="font-accent text-2xl text-white/90">
            Aprender é uma lição de cada dia
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 w-full max-w-sm">
          {[
            { icon: GraduationCap, label: "Gestão de Aulas",      desc: "Agendamentos e histórico" },
            { icon: Users,         label: "Alunos & Professores", desc: "Perfis completos"          },
            { icon: BarChart3,     label: "Relatórios",           desc: "Desempenho e métricas"    },
            { icon: BookOpen,      label: "Material Didático",    desc: "Upload e organização"     },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-white">
              <Icon className="w-6 h-6 mb-2" />
              <p className="font-sub font-semibold text-sm">{label}</p>
              <p className="text-xs text-white/75 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-heading text-2xl text-foreground">LIÇÃO DE CASA</h1>
          </div>

          <div className="mb-8">
            <h2 className="font-sub text-2xl font-bold text-foreground">Bem-vindo de volta!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Entre com seus dados para acessar o sistema
            </p>
          </div>

          <LoginForm error={error} />

          <p className="text-center text-sm text-muted-foreground mt-8">
            Problemas para acessar?{" "}
            <a href="mailto:suporte@licaodecasa.com.br" className="text-primary hover:underline font-medium">
              Fale com o suporte
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
