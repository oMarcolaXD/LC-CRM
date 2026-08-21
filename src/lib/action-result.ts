/**
 * Resultado de server action que pode falhar por regra de negócio.
 *
 * Por que não usar `throw`: em produção o React apaga a mensagem de qualquer
 * erro que atravessa a fronteira do servidor e entrega no lugar um parágrafo em
 * inglês ("An error occurred in the Server Components render..."). Ou seja,
 * `throw new Error("Professor já tem aula às 14:00")` nunca chega ao usuário em
 * produção. Devolver o erro como dado é a única forma de preservar o texto.
 *
 * Erros inesperados (bug, banco fora) continuam sendo lançados e caem no
 * error boundary — ali o texto genérico é o certo mesmo.
 */

import { mensagemDeErro } from "@/lib/error-message"

export type ActionResult<T = undefined> =
  | { ok: true;  data: T }
  | { ok: false; erro: string }

/**
 * Desembrulha o resultado no CLIENTE, lançando se falhou.
 *
 * Relançar aqui é seguro: o erro nasce no navegador, então a mensagem não passa
 * pela redação do React e chega inteira ao `catch` que a tela já tem.
 *
 *   ouFalhe(await createLessonDirectAction({ ... }))
 */
export function ouFalhe<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.erro)
  return r.data
}

/** Exceções de controle de fluxo do Next (redirect/notFound) não são erros. */
function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest
  return typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
}

/**
 * Executa o corpo da action e converte exceção de regra de negócio em
 * `{ ok: false, erro }` — com o texto preservado até a tela.
 */
export async function comResultado<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    if (isNextControlFlow(e)) throw e

    // Registra no servidor: o usuário vê a frase amigável, nós vemos o original
    console.error("[action]", e)
    return { ok: false, erro: mensagemDeErro(e) }
  }
}
