import Link          from "next/link"
import { format }    from "date-fns"
import { ptBR }      from "date-fns/locale"
import { MessageCircle, CalendarDays, UserRound } from "lucide-react"
import type { Prisma } from "@prisma/client"

export type StudentRow = Prisma.StudentGetPayload<{
  include: {
    user: true
    guardian: { include: { user: true } }
    packages: true
    participations: { include: { lesson: { include: { subject: true } } } }
    payments: true
    _count: { select: { packages: true; participations: true } }
  }
}>

export type BoardColumn = "atencao" | "renovar" | "em-dia" | "novos"

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-amber-600",
]

function avatarColor(name: string) {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

function getStatusInfo(pkg: StudentRow["packages"][number] | null) {
  if (!pkg) return { label: "Sem pacote", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }

  const remaining = Number(pkg.remainingLessons)
  const now = new Date()
  const expiresAt = pkg.expiresAt ? new Date(pkg.expiresAt) : null
  const isExpired = expiresAt && expiresAt < now

  if (isExpired) {
    const days = Math.floor((now.getTime() - expiresAt.getTime()) / (86400 * 1000))
    return { label: `Vencido ${days}d`, cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" }
  }
  if (remaining === 0 || pkg.status === "EXHAUSTED") {
    return { label: "Pacote esgotou", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" }
  }
  if (remaining === 1) {
    return { label: "Última aula", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" }
  }
  if (remaining <= 4) {
    return { label: `${remaining} aulas restantes`, cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" }
  }
  return { label: "Pacote ativo", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" }
}

const ACTION_CONFIG: Record<BoardColumn, { label: string; cls: string }> = {
  atencao: {
    label: "Renovar",
    cls:   "bg-primary text-white hover:bg-primary/90",
  },
  renovar: {
    label: "Propor novo pacote",
    cls:   "bg-primary text-white hover:bg-primary/90",
  },
  "em-dia": {
    label: "Detalhes",
    cls:   "border border-[#219EBC] text-[#219EBC] hover:bg-[#219EBC]/10 bg-transparent",
  },
  novos: {
    label: "Detalhes",
    cls:   "border border-[#219EBC] text-[#219EBC] hover:bg-[#219EBC]/10 bg-transparent",
  },
}

interface StudentBoardCardProps {
  student:        StudentRow
  column:         BoardColumn
  detailBasePath: string
}

export function StudentBoardCard({ student, column, detailBasePath }: StudentBoardCardProps) {
  const displayName  = student.name?.trim() || student.user?.name?.trim() || "Aluno"
  const pkg          = student.packages[0] ?? null
  const remaining    = Number(pkg?.remainingLessons ?? 0)
  const nextLesson   = student.participations[0]?.lesson ?? null
  const guardianUser = student.guardian?.user ?? null
  const guardianPhone = guardianUser?.phone?.replace(/\D/g, "") ?? null
  const studentPhone  = student.user?.phone?.replace(/\D/g, "") ?? null
  const waPhone       = guardianPhone ?? studentPhone

  const status        = getStatusInfo(pkg)
  const isInactive    = student.user?.active === false
  const hasNoPackage  = student._count.packages === 0
  const hasNoHistory  = student._count.participations === 0

  const remainingPct = pkg && Number(pkg.totalLessons) > 0
    ? Math.round((Number(pkg.remainingLessons) / Number(pkg.totalLessons)) * 100)
    : 0

  const barColor = remaining === 0 ? "bg-red-400"
    : remaining <= 2             ? "bg-orange-400"
    : remaining <= 4             ? "bg-yellow-400"
    : "bg-green-400"

  const action     = ACTION_CONFIG[column]
  const detailHref = `${detailBasePath}/${student.id}`

  return (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow ${isInactive ? "opacity-65" : ""}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(displayName)}`}>
          {initials(displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Link href={detailHref} className="font-semibold text-sm hover:underline leading-tight truncate block">
                {displayName}
              </Link>
              {/* Badges de status */}
              <div className="flex flex-wrap gap-1 mt-0.5">
                {isInactive && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                    Ex-aluno
                  </span>
                )}
                {!isInactive && hasNoPackage && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                    Sem pacote
                  </span>
                )}
                {!isInactive && hasNoHistory && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                    Sem histórico
                  </span>
                )}
              </div>
            </div>
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {student.grade}
            {nextLesson ? ` · ${nextLesson.subject?.name ?? "–"}` : ""}
          </p>
        </div>
      </div>

      {/* Progress */}
      {pkg && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium tabular-nums">
              {remaining} / {Number(pkg.totalLessons)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={`h-1.5 rounded-full transition-all ${barColor}`}
              style={{ width: `${remainingPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Guardian */}
      {guardianUser && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className="w-3 h-3 shrink-0" />
          <span className="truncate">{guardianUser.name}</span>
          {guardianUser.phone && (
            <span className="shrink-0">· {guardianUser.phone}</span>
          )}
        </div>
      )}

      {/* Next lesson + WhatsApp */}
      <div className="flex items-center justify-between gap-2">
        {nextLesson ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3 shrink-0" />
            <span>Próx: {format(new Date(nextLesson.scheduledAt), "dd/MM HH:mm", { locale: ptBR })}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sem aula agendada</span>
        )}

        {waPhone && (
          <a
            href={`https://wa.me/55${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#219EBC] hover:bg-[#219EBC]/10 transition-colors"
            title="Enviar WhatsApp"
            onClick={e => e.stopPropagation()}
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Action button(s) */}
      {action.label === "Detalhes" ? (
        <Link
          href={detailHref}
          className={`w-full text-center text-xs font-semibold py-1.5 rounded-lg transition-colors ${action.cls}`}
        >
          {action.label}
        </Link>
      ) : (
        <div className="flex gap-2">
          <Link
            href={detailHref}
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors border border-brand-blue text-brand-blue hover:bg-brand-blue/10 bg-transparent"
          >
            Detalhes
          </Link>
          <Link
            href={detailHref}
            className={`flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors ${action.cls}`}
          >
            {action.label}
          </Link>
        </div>
      )}
    </div>
  )
}
