import Image           from "next/image"
import { LoginForm }   from "./login-form"
import { GraduationCap, Users, BarChart3, BookOpen, Heart } from "lucide-react"

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

const FEATURES = [
  { icon: GraduationCap, label: "Gestão de Aulas",      desc: "Agendamentos e histórico", color: "#FB8500" },
  { icon: Users,         label: "Alunos & Professores", desc: "Perfis completos",          color: "#219EBC" },
  { icon: BarChart3,     label: "Relatórios",           desc: "Desempenho e métricas",    color: "#219EBC" },
  { icon: BookOpen,      label: "Material Didático",    desc: "Upload e organização",     color: "#FB8500" },
]

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <div className="h-screen flex overflow-hidden">

      {/* ─── Animações globais ──────────────────────────────────────────── */}
      <style>{`
        /* Float orgânico: multi-stop para movimento não-linear e natural */
        @keyframes lc-float {
          0%   { transform: translate(0px,   0px)  rotate(0deg)    }
          20%  { transform: translate(-2px, -8px)  rotate(-0.4deg) }
          40%  { transform: translate(1px,  -5px)  rotate(0.3deg)  }
          60%  { transform: translate(-1px, -9px)  rotate(-0.2deg) }
          80%  { transform: translate(2px,  -4px)  rotate(0.4deg)  }
          100% { transform: translate(0px,   0px)  rotate(0deg)    }
        }
        @keyframes lc-drift {
          0%   { transform: translate(0px,  0px) rotate(0deg)    }
          25%  { transform: translate(3px, -6px) rotate(0.5deg)  }
          55%  { transform: translate(-2px,-9px) rotate(-0.3deg) }
          80%  { transform: translate(1px, -5px) rotate(0.2deg)  }
          100% { transform: translate(0px,  0px) rotate(0deg)    }
        }
        @keyframes lc-arc {
          0%   { transform: translate(0px, 0px) scale(1)    }
          30%  { transform: translate(6px,-10px) scale(1.02) }
          65%  { transform: translate(-4px,-7px) scale(0.98) }
          100% { transform: translate(0px, 0px) scale(1)    }
        }
        @keyframes lc-blob {
          0%,100% { border-radius:60% 40% 30% 70%/60% 30% 70% 40%; transform:scale(1) }
          33%     { border-radius:40% 60% 55% 45%/45% 55% 45% 55%; transform:scale(1.04) }
          66%     { border-radius:55% 45% 60% 40%/40% 65% 45% 55%; transform:scale(0.97) }
        }

        .lc-float { animation: lc-float 11s ease-in-out infinite;        will-change: transform; }
        .lc-drift { animation: lc-drift  9s ease-in-out infinite 1.5s;   will-change: transform; }
        .lc-arc   { animation: lc-arc   14s ease-in-out infinite;        will-change: transform; }
        .lc-blob  { animation: lc-blob  13s ease-in-out infinite;        will-change: transform, border-radius; }

        /* Cards: spring lift no hover */
        .lc-card {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
          cursor: default;
        }
        .lc-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(2,48,71,0.13), 0 6px 14px rgba(2,48,71,0.07);
        }
        .lc-quote {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
        }
        .lc-quote:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 36px rgba(2,48,71,0.11), 0 4px 10px rgba(2,48,71,0.06);
        }
      `}</style>

      {/* ─── Painel esquerdo ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#FDF8EF] flex-col items-center justify-center p-10">

        {/* Arco laranja — canto superior-esquerdo */}
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#FB8500] lc-arc" />

        {/* Dots grid */}
        <div className="absolute top-10 left-14 grid grid-cols-5 gap-1.5 lc-drift">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#FB8500]/40" />
          ))}
        </div>

        {/* Mini círculos — canto superior-direito */}
        <div className="absolute top-7 right-10 flex gap-2 lc-drift" style={{ animationDelay: "3s" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-[#FB8500]/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FB8500]/25" />
        </div>

        {/* Blob azul — canto inferior-direito */}
        <div
          className="absolute -bottom-24 -right-20 w-80 h-80 bg-[#219EBC]/22 lc-blob"
          style={{ borderRadius: "60% 40% 30% 70%/60% 30% 70% 40%" }}
        />

        {/* ── Conteúdo central ─────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-sm gap-5">

          {/* Logo flutuando */}
          <div className="lc-float rounded-full overflow-hidden shadow-md">
            <Image src="/logo.svg" alt="Lição de Casa" width={84} height={84} priority />
          </div>

          {/* Título + tagline */}
          <div>
            <h1 className="font-heading text-4xl text-[#023047] tracking-wide leading-none">
              LIÇÃO DE CASA
            </h1>
            <p className="font-accent text-lg text-[#FB8500] mt-1">
              Aprender é uma lição de cada dia.
            </p>
          </div>

          {/* Headline */}
          <p className="font-sub text-[#023047] text-lg font-semibold leading-snug">
            Sua plataforma completa para uma{" "}
            <span className="text-[#FB8500]">educação</span> que{" "}
            <span className="text-[#FB8500]">transforma.</span>
          </p>

          {/* Feature cards 2×2 */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {FEATURES.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="lc-card bg-white rounded-2xl p-4 shadow-sm text-left">
                <Icon style={{ color }} className="w-6 h-6 mb-2" />
                <p className="font-sub font-bold text-[#023047] text-sm leading-tight">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</p>
              </div>
            ))}
          </div>

          {/* Quote card */}
          <div className="lc-quote bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 w-full text-left">
            <div className="w-9 h-9 rounded-full bg-[#FB8500]/10 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-[#FB8500]" fill="#FB8500" />
            </div>
            <p className="text-sm text-[#023047] font-body leading-snug">
              Organize, acompanhe e transforme a jornada de{" "}
              <span className="text-[#219EBC] font-semibold">aprendizado</span> de cada aluno.
            </p>
          </div>

        </div>
      </div>

      {/* ─── Painel direito ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 bg-background overflow-y-auto">
        <div className="w-full max-w-[420px] py-8">

          {/* Logo — apenas mobile */}
          <div className="flex lg:hidden justify-center mb-8">
            <Image src="/logo.svg" alt="Lição de Casa" width={140} height={48} priority />
          </div>

          <h2 className="font-sub text-2xl font-bold text-foreground mb-1">
            Bem-vindo de volta! 👋
          </h2>
          <p className="text-muted-foreground text-sm mb-7">
            Entre com seus dados para acessar o sistema.
          </p>

          <LoginForm error={error} />

        </div>
      </div>

    </div>
  )
}
