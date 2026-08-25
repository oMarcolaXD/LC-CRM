/**
 * Regras de ocupação da agenda — fonte única de verdade para conflitos.
 *
 * Toda criação/edição de aula valida por aqui ANTES de persistir. As consultas
 * usam uma janela em tempo absoluto (e não `startOfDay`/`endOfDay`) porque o
 * servidor de produção roda em UTC: o "dia" do servidor não coincide com o dia
 * de Brasília, e uma aula do fim da noite escaparia da janela. Ver
 * src/lib/datetime.ts.
 */

import type { LessonType, LessonStatus } from "@prisma/client"
import { prisma }          from "@/lib/prisma"
import { getRoomCount, getOperationalConfig, isOperational } from "@/lib/config"
import { formatBR, toBrazilDate } from "@/lib/datetime"
import { DEFAULT_DURATION } from "@/lib/lessons"
import { isWithinAvailability, windowsAt, DAY_NAMES } from "@/lib/availability"
import type { Availability } from "@/lib/availability"

/** Status que ocupam a agenda — CANCELLED/COMPLETED/MISSED liberam o horário. */
export const BLOCKING_STATUSES = ["SCHEDULED", "CONFIRMED"] as const

/**
 * Status que ocupam a hora do professor ao validar um slot.
 *
 * Para o futuro é a agenda: SCHEDULED e CONFIRMED. Para o passado é o
 * histórico, e aí COMPLETED também ocupa — a hora já foi dada. Sem isso,
 * registrar uma aula retroativa em cima de outra já realizada passava batido, e
 * `computePayout` somava as duas durações: a mesma hora paga duas vezes.
 *
 * MISSED fica de fora nos dois casos: o aluno faltou e a aula não entra no
 * repasse, então a hora está de fato livre.
 */
function occupancyStatuses(at: Date, now = new Date()): LessonStatus[] {
  return at < now
    ? [...BLOCKING_STATUSES, "COMPLETED"]
    : [...BLOCKING_STATUSES]
}

export { DEFAULT_DURATION }

/** Maior duração plausível — define a folga da janela de busca de candidatos. */
const MAX_LESSON_MINUTES = 8 * 60

export interface Slot {
  scheduledAt: Date
  duration?:   number | null
}

function minutesOf(slot: Slot): number {
  return slot.duration ?? DEFAULT_DURATION
}

/** true se os intervalos [início, início+duração) de dois slots se sobrepõem. */
export function overlaps(a: Slot, b: Slot): boolean {
  const aStart = a.scheduledAt.getTime()
  const bStart = b.scheduledAt.getTime()
  return aStart < bStart + minutesOf(b) * 60_000
      && bStart < aStart + minutesOf(a) * 60_000
}

/**
 * Filtro de `scheduledAt` que traz todas as aulas capazes de alcançar o slot.
 * O recorte exato fica com `overlaps` — aqui só reduzimos o volume lido,
 * aproveitando o índice [teacherId, status, scheduledAt].
 */
function candidateWindow(slot: Slot) {
  const start = slot.scheduledAt.getTime()
  return {
    gte: new Date(start - MAX_LESSON_MINUTES * 60_000),
    lt:  new Date(start + minutesOf(slot) * 60_000),
  }
}

const CONFLICT_SELECT = {
  id:          true,
  scheduledAt: true,
  duration:    true,
  lessonType:  true,
  title:       true,
  subject:     { select: { name: true } },
} as const

export interface ConflictingLesson {
  id:          string
  scheduledAt: Date
  duration:    number
  lessonType:  LessonType
  title:       string | null
  subject:     { name: string } | null
}

// ─── Conflito de professor ────────────────────────────────────────────────────

export interface TeacherSlotQuery extends Slot {
  teacherId: string
  /** Aula em edição: não pode conflitar consigo mesma. */
  excludeLessonId?: string
}

/** Aulas ativas do professor que se sobrepõem ao slot pedido. */
export async function findTeacherConflicts(q: TeacherSlotQuery): Promise<ConflictingLesson[]> {
  const candidates = await prisma.lesson.findMany({
    where: {
      teacherId:    q.teacherId,
      status:       { in: occupancyStatuses(q.scheduledAt) },
      blocksAgenda: true,
      scheduledAt:  candidateWindow(q),
      ...(q.excludeLessonId ? { id: { not: q.excludeLessonId } } : {}),
    },
    select:  CONFLICT_SELECT,
    orderBy: { scheduledAt: "asc" },
  })
  return candidates.filter((l) => overlaps(q, l))
}

// ─── Avaliação em lote (séries recorrentes) ───────────────────────────────────
// Uma série de 50 aulas não pode custar 100 idas ao banco: carregamos a agenda
// relevante de uma vez (uma consulta com a janela de cada ocorrência) e o
// recorte fica com `overlaps`, o mesmo usado no caminho de uma aula só.

function windowsFor(slots: Slot[]) {
  return slots.map((s) => ({ scheduledAt: candidateWindow(s) }))
}

/**
 * Aulas do professor que podem alcançar qualquer um dos slots.
 *
 * Basta uma ocorrência no passado para que as realizadas entrem na varredura —
 * separar por slot exigiria uma consulta por ocorrência. O excedente só faz
 * diferença se uma aula futura já estiver marcada como realizada, o que é
 * registro errado de qualquer forma.
 */
export async function loadTeacherAgendaFor(
  teacherId: string,
  slots:     Slot[],
): Promise<ConflictingLesson[]> {
  if (slots.length === 0) return []
  const maisAntigo = slots.reduce((a, b) => (a.scheduledAt <= b.scheduledAt ? a : b))
  return prisma.lesson.findMany({
    where: {
      teacherId,
      status:       { in: occupancyStatuses(maisAntigo.scheduledAt) },
      blocksAgenda: true,
      OR:           windowsFor(slots),
    },
    select:  CONFLICT_SELECT,
    orderBy: { scheduledAt: "asc" },
  })
}

/** Slot que carrega o id da aula — necessário para ignorar a própria aula. */
export interface SlotWithId extends Slot {
  id: string
}

/** Aulas que ocupam sala e podem alcançar qualquer um dos slots. */
export async function loadRoomAgendaFor(slots: Slot[]): Promise<SlotWithId[]> {
  if (slots.length === 0) return []
  return prisma.lesson.findMany({
    where: {
      status:       { in: [...BLOCKING_STATUSES] },
      blocksAgenda: true,
      AND: [
        { OR: [{ modality: "PRESENCIAL" }, { modality: "ONLINE", teacherOnsite: true }] },
        { OR: windowsFor(slots) },
      ],
    },
    select: { id: true, scheduledAt: true, duration: true },
  })
}

/** Primeiro conflito do slot dentro de uma agenda já carregada. */
export function findConflictIn(slot: Slot, agenda: ConflictingLesson[]): ConflictingLesson | undefined {
  return agenda.find((l) => overlaps(slot, l))
}

/** Quantas aulas da agenda carregada se sobrepõem ao slot. */
export function countOverlapsIn(slot: Slot, agenda: Slot[]): number {
  return agenda.filter((l) => overlaps(slot, l)).length
}

/** Descreve a aula conflitante em português, para a mensagem de erro. */
export function describeLesson(l: ConflictingLesson): string {
  const subject = l.subject ? ` de ${l.subject.name}` : ""
  const what =
    l.lessonType === "COMPROMISSO" ? (l.title?.trim() || "um compromisso")
  : l.lessonType === "AULAO"       ? `o aulão "${l.title?.trim() || "sem título"}"`
  : l.lessonType === "GROUP"       ? `uma aula em grupo${subject}`
  :                                  `uma aula${subject}`
  return `${what} às ${formatBR(l.scheduledAt, "HH:mm")}`
}

/**
 * Bloqueia o agendamento se o professor já tiver algo no horário.
 *
 * Aulas em grupo/aulão NÃO liberam o horário do professor: para atender outro
 * aluno no mesmo slot, ele deve entrar como participante da aula em grupo já
 * existente (uma única aula com vários alunos) — ver `enrollStudentInAulaoAction`
 * e `createDuoLessonAction`. É essa a única sobreposição autorizada.
 */
export async function assertTeacherFree(q: TeacherSlotQuery, teacherName?: string): Promise<void> {
  const [conflict] = await findTeacherConflicts(q)
  if (!conflict) return

  const who  = teacherName?.trim().split(" ")[0] ?? "O professor"
  const hint =
    conflict.lessonType === "GROUP" || conflict.lessonType === "AULAO"
      ? " Para atender outro aluno neste horário, inscreva-o na aula em grupo já existente."
    : conflict.lessonType === "INDIVIDUAL"
      // Dois irmãos atendidos juntos viravam duas aulas individuais no mesmo
      // horário — e o repasse paga a mesma hora duas vezes. O registro certo é
      // uma aula só, com os dois como participantes.
      ? " Se os dois alunos foram atendidos juntos, registre como aula em dupla — assim a hora do professor não é paga duas vezes."
      : ""

  throw new Error(`Conflito de agenda: ${who} já tem ${describeLesson(conflict)}.${hint}`)
}

// ─── Disponibilidade do professor ────────────────────────────────────────────
// O horário cadastrado no perfil do professor era só um desenho de fundo na
// agenda: nada impedia marcar às 20:30 para quem atende até as 18:30. Como a
// disponibilidade é o que o professor combinou com a escola, ela vale como
// regra — quem precisar sair dela ajusta o cadastro do professor.

export interface TeacherAvailabilityQuery extends Slot {
  teacherId: string
}

function describeWindows(slots: { start: string; end: string }[]): string {
  return slots.map((s) => `${s.start}–${s.end}`).join(" e ")
}

/**
 * Descreve por que o slot não cabe na disponibilidade — `null` quando cabe.
 *
 * Versão pura, para quem já tem a disponibilidade em mãos (séries validam
 * dezenas de ocorrências e não podem ir ao banco em cada uma).
 */
export function availabilityProblem(
  slot:         Slot,
  availability: Availability,
  teacherName?: string,
): string | null {
  // Professor sem nenhuma disponibilidade cadastrada não tem regra a aplicar —
  // bloquear aqui travaria a agenda inteira dele até alguém preencher o perfil.
  if (Object.values(availability).every((slots) => !slots?.length)) return null

  const duration = minutesOf(slot)
  if (isWithinAvailability(slot.scheduledAt, availability, duration)) return null

  const who     = teacherName?.trim().split(" ")[0] ?? "O professor"
  const dia     = DAY_NAMES[toBrazilDate(slot.scheduledAt).getDay()].toLowerCase()
  const janelas = windowsAt(slot.scheduledAt, availability)
  const quando  = janelas.length
    ? `atende ${dia} das ${describeWindows(janelas)}`
    : `não atende ${dia}`

  return `${who} ${quando} — e esta aula é ${formatBR(slot.scheduledAt, "HH:mm")} com ${duration} min.`
}

/** Bloqueia o agendamento fora dos horários que o professor atende. */
export async function assertTeacherAvailable(
  q:            TeacherAvailabilityQuery,
  teacherName?: string,
): Promise<void> {
  const teacher = await prisma.teacher.findUnique({
    where:  { id: q.teacherId },
    select: { availability: true },
  })
  const problema = availabilityProblem(
    q,
    (teacher?.availability ?? {}) as unknown as Availability,
    teacherName,
  )
  if (!problema) return

  throw new Error(
    `Fora da disponibilidade: ${problema} `
    + `Escolha outro horário ou atualize a disponibilidade no cadastro do professor.`
  )
}

// ─── Conflito de salas ────────────────────────────────────────────────────────

/** Uma aula ocupa sala quando é presencial ou online com o professor na sede. */
export function occupiesRoom(modality: "PRESENCIAL" | "ONLINE", teacherOnsite: boolean): boolean {
  return modality === "PRESENCIAL" || (modality === "ONLINE" && teacherOnsite)
}

export interface RoomSlotQuery extends Slot {
  excludeLessonId?: string
}

/** Quantas salas estão ocupadas no intervalo do slot. */
export async function countRoomConflicts(q: RoomSlotQuery): Promise<number> {
  const candidates = await prisma.lesson.findMany({
    where: {
      OR: [
        { modality: "PRESENCIAL" },
        { modality: "ONLINE", teacherOnsite: true },
      ],
      status:       { in: [...BLOCKING_STATUSES] },
      blocksAgenda: true,
      scheduledAt:  candidateWindow(q),
      ...(q.excludeLessonId ? { id: { not: q.excludeLessonId } } : {}),
    },
    select: { scheduledAt: true, duration: true },
  })
  return candidates.filter((l) => overlaps(q, l)).length
}

/** Mensagem padrão de sala lotada. */
function roomsFullMessage(roomCount: number, suggestOnline: boolean): string {
  const plural = roomCount !== 1 ? "s" : ""
  return `Todas as ${roomCount} sala${plural} estão ocupadas neste horário.`
       + (suggestOnline ? " Altere para ONLINE (em casa) para agendar mesmo assim." : "")
}

/** Bloqueia o agendamento se não houver sala livre no intervalo. */
export async function assertRoomFree(
  q: RoomSlotQuery,
  opts: { suggestOnline?: boolean } = {},
): Promise<void> {
  const roomCount = await getRoomCount()
  if (await countRoomConflicts(q) >= roomCount) {
    throw new Error(roomsFullMessage(roomCount, opts.suggestOnline ?? true))
  }
}

// ─── Mover uma série inteira de uma vez ──────────────────────────────────────
// Editar "toda a série" desloca N aulas no mesmo movimento. A validação precisa
// (a) olhar todos os horários novos numa varredura só e (b) ignorar as próprias
// aulas que estão sendo movidas — senão cada ocorrência conflitaria consigo
// mesma, já que no banco ela ainda está no horário antigo.

export interface SeriesConflict {
  /** Aula da série que não coube no horário novo. */
  id:     string
  when:   string   // "12/08 às 14:00"
  reason: string
}

export async function findSeriesConflicts(opts: {
  teacherId:    string
  teacherName?: string
  needsRoom:    boolean
  /** Ocorrências já no horário NOVO, cada uma com o id da aula que será movida. */
  slots:        SlotWithId[]
}): Promise<SeriesConflict[]> {
  if (opts.slots.length === 0) return []

  const movendo = new Set(opts.slots.map((s) => s.id))

  const [teacherAgenda, roomAgenda, roomCount] = await Promise.all([
    loadTeacherAgendaFor(opts.teacherId, opts.slots),
    opts.needsRoom ? loadRoomAgendaFor(opts.slots) : Promise.resolve([]),
    opts.needsRoom ? getRoomCount() : Promise.resolve(0),
  ])

  const outrasAulas = teacherAgenda.filter((l) => !movendo.has(l.id))
  const outrasSalas = roomAgenda.filter((l) => !movendo.has(l.id))
  const quem        = opts.teacherName?.trim().split(" ")[0] ?? "O professor"

  const conflicts: SeriesConflict[] = []
  const jaAceitos: Slot[] = []

  for (const slot of opts.slots) {
    const when = formatBR(slot.scheduledAt, "dd/MM 'às' HH:mm")

    // Duas ocorrências da mesma série podem cair uma sobre a outra depois do
    // deslocamento (duas aulas no mesmo dia em horários diferentes, por ex.).
    // O banco não acusa isso: as duas estão sendo movidas ao mesmo tempo.
    if (jaAceitos.some((a) => overlaps(slot, a))) {
      conflicts.push({ id: slot.id, when, reason: "choca com outra ocorrência da própria série" })
      continue
    }

    if (opts.needsRoom && countOverlapsIn(slot, outrasSalas) >= roomCount) {
      conflicts.push({
        id: slot.id,
        when,
        reason: `todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas`,
      })
      continue
    }

    const clash = findConflictIn(slot, outrasAulas)
    if (clash) {
      conflicts.push({ id: slot.id, when, reason: `${quem} já tem ${describeLesson(clash)}` })
      continue
    }

    jaAceitos.push(slot)
  }

  return conflicts
}

/**
 * Mensagem única para a série que não pôde ser movida. Nada é alterado quando há
 * conflito: mover metade da série deixaria a agenda pior do que estava.
 */
export function seriesConflictMessage(conflicts: SeriesConflict[]): string {
  const shown = conflicts.slice(0, 5).map((c) => `${c.when} — ${c.reason}`).join("; ")
  const rest  = conflicts.length > 5 ? ` (e mais ${conflicts.length - 5})` : ""
  return `Conflito em ${conflicts.length} ocorrência${conflicts.length !== 1 ? "s" : ""} da série: `
       + `${shown}${rest}. Nada foi alterado — ajuste esses horários ou edite só esta ocorrência.`
}

// ─── Horário de funcionamento da escola ──────────────────────────────────────

/** Bloqueia o agendamento fora dos dias/horas de funcionamento configurados. */
export async function assertWithinOperationalHours(at: Date): Promise<void> {
  const cfg = await getOperationalConfig()
  if (isOperational(at, cfg)) return

  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
  const dowNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  throw new Error(
    `Fora do horário de funcionamento (${cfg.days.map((d) => dowNames[d]).join(", ")}, ` +
    `${hhmm(cfg.startMin)}–${hhmm(cfg.endMin)}). ` +
    `Verifique as configurações ou escolha outro horário.`
  )
}
