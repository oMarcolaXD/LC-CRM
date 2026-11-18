import { prisma } from "@/lib/prisma"

/**
 * Devolve `custo` aulas aos pacotes do aluno quando uma aula é cancelada.
 *
 * Antes, todo cancelamento somava no pacote MAIS RECENTE, sem limite. Se a aula
 * tinha saído de um pacote anterior (ex.: o aluno renovou e depois cancelou uma
 * aula já marcada), o pacote novo ficava com mais saldo do que aulas — e o
 * perfil mostrava "Usadas" negativo.
 *
 * Agora a devolução preenche o espaço usado (total − restante) do pacote mais
 * novo para o mais antigo, e nenhum pacote passa do próprio total. O débito
 * sai do pacote mais novo primeiro, então a ordem espelha o caminho inverso.
 * Se não houver espaço em nenhum (a aula não tinha sido descontada), nada é
 * devolvido — não existe saldo fantasma.
 *
 * Devolve operações para colocar no mesmo `$transaction` da mudança de status.
 */
export async function operacoesDeDevolucao(studentId: string, custo: number) {
  if (custo <= 0) return []
  const pacotes = await prisma.lessonPackage.findMany({
    where:   { studentId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
    orderBy: { purchaseDate: "desc" },
    select:  { id: true, totalLessons: true, remainingLessons: true },
  })

  let falta = Math.round(custo * 10) / 10
  const ops = []
  for (const p of pacotes) {
    if (falta <= 0) break
    const total    = Number(p.totalLessons)
    const restante = Number(p.remainingLessons)
    const espaco   = Math.round(Math.max(0, total - restante) * 10) / 10
    if (espaco <= 0) continue
    const parte    = Math.min(espaco, falta)
    const novo     = Math.round((restante + parte) * 10) / 10
    ops.push(prisma.lessonPackage.update({
      where: { id: p.id },
      data:  { remainingLessons: novo, status: novo > 0 ? "ACTIVE" : "EXHAUSTED" },
    }))
    falta = Math.round((falta - parte) * 10) / 10
  }
  return ops
}
