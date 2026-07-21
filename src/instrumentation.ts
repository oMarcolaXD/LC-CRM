/**
 * Executado uma vez na inicialização do servidor (Next.js instrumentation).
 *
 * Fixa o fuso horário do processo em America/Sao_Paulo para que toda
 * formatação de datas no servidor (SSR) use o horário de Brasília — o mesmo
 * que o navegador dos usuários. Sem isto, o Vercel roda em UTC e as aulas
 * aparecem 3 horas adiantadas nas páginas renderizadas no servidor.
 *
 * IMPORTANTE: a atribuição é INCONDICIONAL. A Vercel/AWS Lambda já define
 * `process.env.TZ = "UTC"` por padrão, então um `?? "America/Sao_Paulo"` nunca
 * teria efeito (o valor "UTC" já é truthy) — deixando o servidor em UTC apesar
 * deste arquivo. Sobrescrevemos sempre.
 */
export function register() {
  process.env.TZ = "America/Sao_Paulo"
}
