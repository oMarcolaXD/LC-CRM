/**
 * Traduz erros para uma frase que um leigo entenda.
 *
 * Por que isto existe: em produção o React substitui a mensagem de qualquer erro
 * que atravessa a fronteira do servidor por um parágrafo em inglês ("An error
 * occurred in the Server Components render..."). Sem tratamento, é isso que
 * aparece no aviso da tela. Erros do Prisma e falhas de rede têm o mesmo
 * problema: o texto é técnico e não diz o que fazer.
 *
 * Módulo puro, sem dependências — pode ser usado em client e server.
 */

/** Frase padrão quando não há nada de útil a dizer. */
const GENERICO = "Não foi possível concluir a ação. Tente novamente."

/**
 * Trechos que denunciam texto técnico. Se a mensagem contiver qualquer um
 * deles, ela não é mostrada ao usuário.
 */
const TECNICO = [
  "An error occurred in the Server Components render",
  "omitted in production",
  "Server Components",
  "digest",
  "Invalid `prisma",
  "prisma.",
  "PrismaClient",
  "Unique constraint",
  "Foreign key constraint",
  "connect ECONNREFUSED",
  "ETIMEDOUT",
  "Can't reach database server",
  "Timed out fetching a new connection",
  "at async",         // stack trace vazando na mensagem
  "webpack",
  "Hydration",
  "Minified React error",
  "Cannot read properties",
  "is not a function",
  "undefined is not",
]

/**
 * Erros nativos do JavaScript são sempre falha de programação, nunca texto
 * escrito para o usuário — a mensagem deles nunca vai para a tela.
 */
const ERROS_DE_CODIGO = new Set([
  "TypeError", "RangeError", "ReferenceError", "SyntaxError", "EvalError", "URIError",
])

/** Padrões conhecidos → frase útil, com o que fazer em seguida. */
const CONHECIDOS: { teste: RegExp; frase: string }[] = [
  {
    teste: /Unique constraint failed.*email|email.*já (está )?(em uso|cadastrado)/i,
    frase: "Este e-mail já está cadastrado para outra pessoa.",
  },
  {
    teste: /Unique constraint/i,
    frase: "Este registro já existe no sistema.",
  },
  {
    teste: /Foreign key constraint|violates foreign key/i,
    frase: "Este item está ligado a outros registros e não pode ser alterado assim.",
  },
  {
    teste: /Can't reach database server|Timed out fetching a new connection|ECONNREFUSED/i,
    frase: "O sistema está sem conexão com o banco de dados. Tente de novo em alguns instantes.",
  },
  {
    teste: /Failed to fetch|NetworkError|network request failed|Load failed/i,
    frase: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  },
  {
    teste: /ETIMEDOUT|timeout/i,
    frase: "A operação demorou demais e foi interrompida. Tente novamente.",
  },
  {
    teste: /Record to update not found|No record was found|P2025/i,
    frase: "Este registro não existe mais — talvez tenha sido removido por outra pessoa. Atualize a página.",
  },
  {
    teste: /Sem permiss/i,
    frase: "Você não tem permissão para fazer isso.",
  },
]

/** A mensagem parece escrita para uma pessoa, e não para um programador? */
function pareceHumana(msg: string): boolean {
  if (msg.length === 0 || msg.length > 320) return false
  if (msg.includes("\n")) return false                    // stack trace / erro do Prisma
  if (TECNICO.some((t) => msg.includes(t))) return false
  if (/^[A-Z][a-z]+Error\b/.test(msg)) return false       // "TypeError: ..."
  if (/^[EP]\d{3,4}\b/.test(msg)) return false            // códigos tipo P2002
  return true
}

/**
 * Devolve a frase a mostrar ao usuário.
 *
 * @param erro     o que veio do catch
 * @param fallback frase específica do contexto, ex: "Erro ao salvar o aluno"
 */
export function mensagemDeErro(erro: unknown, fallback?: string): string {
  const bruta =
    erro instanceof Error ? erro.message
    : typeof erro === "string" ? erro
    : ""

  if (!bruta) return fallback ?? GENERICO

  // 1. Padrão conhecido tem prioridade: diz o que aconteceu E o que fazer
  const conhecido = CONHECIDOS.find((c) => c.teste.test(bruta))
  if (conhecido) return conhecido.frase

  // 2. Falha de programação nunca vai para a tela
  if (erro instanceof Error && ERROS_DE_CODIGO.has(erro.name)) {
    return fallback ?? GENERICO
  }

  // 3. Mensagem nossa, escrita em português para o usuário: passa direto
  if (pareceHumana(bruta)) return bruta

  // 4. Sobrou texto técnico — não mostramos
  return fallback ?? GENERICO
}

/**
 * Igual a `mensagemDeErro`, mas garante que o texto do contexto apareça.
 * Use quando o fallback for informativo, ex: "Não foi possível salvar o aluno".
 */
export function mensagemDeErroCom(contexto: string, erro: unknown): string {
  const detalhe = mensagemDeErro(erro, "")
  return detalhe && detalhe !== GENERICO ? `${contexto}: ${detalhe}` : contexto
}
