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

// ─── Acerto dos pacotes que já ficaram errados ────────────────────────────────

export interface AjustePacote {
  pacoteId:     string
  compra:       Date
  status:       string
  total:        number
  antes:        number
  depois:       number
  /** true = é o pacote que estava com saldo acima do total */
  estourado:    boolean
}

export interface AcertoAluno {
  studentId:   string
  nome:        string
  ra:          string
  ajustes:     AjustePacote[]
  /** Aulas que sobraram e não cabiam em nenhum pacote anterior (saem do saldo). */
  descartadas: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Calcula, sem gravar nada, como acertar os pacotes com saldo acima do total
 * (resíduo do bug antigo do cancelamento). O excesso volta para os outros
 * pacotes ativos/esgotados do aluno, do mais novo para o mais antigo, até o
 * total de cada um — a mesma regra que o cancelamento usa agora. O que não
 * couber em lugar nenhum sai do saldo (fica em `descartadas`, visível na tela).
 */
export async function planejarAcertoPacotes(): Promise<AcertoAluno[]> {
  const quebrados = await prisma.$queryRaw<{ studentId: string }[]>`
    SELECT DISTINCT "studentId" FROM "lesson_packages" WHERE "remainingLessons" > "totalLessons"
  `
  if (quebrados.length === 0) return []

  const pacotes = await prisma.lessonPackage.findMany({
    where:   { studentId: { in: quebrados.map((q) => q.studentId) } },
    orderBy: { purchaseDate: "desc" },
    include: { student: { select: { name: true, ra: true } } },
  })

  const porAluno = new Map<string, typeof pacotes>()
  for (const p of pacotes) porAluno.set(p.studentId, [...(porAluno.get(p.studentId) ?? []), p])

  const plano: AcertoAluno[] = []
  for (const [studentId, lista] of porAluno) {
    const saldo = new Map(lista.map((p) => [p.id, Number(p.remainingLessons)]))
    let descartadas = 0
    for (const p of lista) {
      const total   = Number(p.totalLessons)
      const excesso = r1((saldo.get(p.id) ?? 0) - total)
      if (excesso <= 0) continue
      saldo.set(p.id, total)
      let falta = excesso
      for (const o of lista) {
        if (falta <= 0) break
        if (o.id === p.id || (o.status !== "ACTIVE" && o.status !== "EXHAUSTED")) continue
        const espaco = r1(Number(o.totalLessons) - (saldo.get(o.id) ?? 0))
        if (espaco <= 0) continue
        const parte = Math.min(espaco, falta)
        saldo.set(o.id, r1((saldo.get(o.id) ?? 0) + parte))
        falta = r1(falta - parte)
      }
      descartadas = r1(descartadas + falta)
    }
    const ajustes = lista
      .filter((p) => r1(Number(p.remainingLessons)) !== r1(saldo.get(p.id) ?? 0))
      .map((p) => ({
        pacoteId:  p.id,
        compra:    p.purchaseDate,
        status:    p.status,
        total:     Number(p.totalLessons),
        antes:     Number(p.remainingLessons),
        depois:    r1(saldo.get(p.id) ?? 0),
        estourado: Number(p.remainingLessons) > Number(p.totalLessons),
      }))
    if (ajustes.length) plano.push({ studentId, nome: lista[0].student.name, ra: lista[0].student.ra, ajustes, descartadas })
  }
  return plano.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}
