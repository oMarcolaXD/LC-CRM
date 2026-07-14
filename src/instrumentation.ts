/**
 * Executado uma vez na inicialização do servidor (Next.js instrumentation).
 *
 * Fixa o fuso horário do processo em America/Sao_Paulo para que toda
 * formatação de datas no servidor (SSR) use o horário de Brasília — o mesmo
 * que o navegador dos usuários. Sem isto, o Vercel roda em UTC e as aulas
 * aparecem 3 horas adiantadas nas páginas renderizadas no servidor.
 */
export function register() {
  process.env.TZ = process.env.TZ ?? "America/Sao_Paulo"
}
