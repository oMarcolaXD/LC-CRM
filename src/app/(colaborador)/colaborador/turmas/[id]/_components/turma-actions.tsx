"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format }    from "date-fns"
import { toast }     from "sonner"
import {
  UserPlus, CalendarPlus, CheckCheck, Ban, Trash2, Loader2, Search, UserMinus,
} from "lucide-react"
import { Button }    from "@/components/ui/button"
import { Input }     from "@/components/ui/input"
import { Label }     from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  enrollStudentAction, unenrollStudentAction, addCourseLessonAction,
  finishCourseAction, cancelCourseAction, deleteCourseAction,
} from "@/lib/actions/course"
import { ouFalhe }        from "@/lib/action-result"
import { mensagemDeErro } from "@/lib/error-message"

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

interface AlunoOption { id: string; name: string; ra: string }

// ─── Ações do cabeçalho ───────────────────────────────────────────────────────

export function TurmaActions({
  courseId, status, isAdmin, alunosDisponiveis,
}: {
  courseId:          string
  status:            "ACTIVE" | "FINISHED" | "CANCELLED"
  isAdmin:           boolean
  alunosDisponiveis: AlunoOption[]
}) {
  const router = useRouter()
  const [matricular, setMatricular] = useState(false)
  const [encontro,   setEncontro]   = useState(false)
  const [pending, start] = useTransition()

  const ativa = status === "ACTIVE"

  function encerrar() {
    if (!confirm("Encerrar a turma? Os encontros que ainda não aconteceram serão cancelados.")) return
    start(async () => {
      try {
        ouFalhe(await finishCourseAction(courseId))
        toast.success("Turma encerrada")
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Erro ao encerrar turma")) }
    })
  }

  function cancelar() {
    if (!confirm("Cancelar a turma? Os encontros futuros são cancelados e as cobranças ainda não pagas são apagadas.")) return
    start(async () => {
      try {
        ouFalhe(await cancelCourseAction(courseId))
        toast.success("Turma cancelada")
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Erro ao cancelar turma")) }
    })
  }

  function excluir() {
    if (!confirm("Excluir a turma definitivamente? As cobranças somem junto e os encontros viram aulas em grupo soltas no histórico.")) return
    start(async () => {
      try {
        ouFalhe(await deleteCourseAction(courseId))
        toast.success("Turma excluída")
        router.push("/colaborador/turmas")
      } catch (e) { toast.error(mensagemDeErro(e, "Erro ao excluir turma")) }
    })
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-end">
        {ativa && (
          <>
            <Button size="sm" variant="outline" onClick={() => setMatricular(true)} disabled={pending}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              Matricular
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEncontro(true)} disabled={pending}>
              <CalendarPlus className="w-4 h-4 mr-1.5" />
              Encontro extra
            </Button>
            <Button size="sm" variant="outline" onClick={encerrar} disabled={pending}>
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Encerrar
            </Button>
            <Button size="sm" variant="outline" onClick={cancelar} disabled={pending}
              className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Ban className="w-4 h-4 mr-1.5" />
              Cancelar
            </Button>
          </>
        )}
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={excluir} disabled={pending}
            className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-1.5" />
            Excluir
          </Button>
        )}
      </div>

      <MatricularDialog
        open={matricular}
        onClose={() => setMatricular(false)}
        courseId={courseId}
        alunos={alunosDisponiveis}
      />
      <EncontroExtraDialog
        open={encontro}
        onClose={() => setEncontro(false)}
        courseId={courseId}
      />
    </>
  )
}

// ─── Matricular aluno ─────────────────────────────────────────────────────────

function MatricularDialog({
  open, onClose, courseId, alunos,
}: {
  open: boolean; onClose: () => void; courseId: string; alunos: AlunoOption[]
}) {
  const router = useRouter()
  const [busca, setBusca] = useState("")
  const [pending, start]  = useTransition()

  const filtrados = busca.trim()
    ? alunos.filter(a => norm(a.name).includes(norm(busca.trim())) || a.ra.includes(busca.trim()))
    : alunos

  function matricular(studentId: string, nome: string) {
    start(async () => {
      try {
        const r = ouFalhe(await enrollStudentAction(courseId, studentId))
        toast.success(
          `${nome} matriculado · entrou em ${r.aulas} encontro${r.aulas !== 1 ? "s" : ""}` +
          (r.cobrancas > 0 ? ` · ${r.cobrancas} parcela${r.cobrancas !== 1 ? "s" : ""} gerada${r.cobrancas !== 1 ? "s" : ""}` : ""),
        )
        onClose()
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Erro ao matricular")) }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Matricular aluno
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Quem entra agora participa só dos encontros que ainda vão acontecer e recebe apenas as
          parcelas que ainda vão vencer.
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome ou R.A...."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-input divide-y">
          {filtrados.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              Nenhum aluno disponível
            </p>
          ) : filtrados.map(a => (
            <button
              key={a.id}
              type="button"
              disabled={pending}
              onClick={() => matricular(a.id, a.name)}
              className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              <span className="truncate">{a.name}</span>
              <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">{a.ra}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Encontro extra ───────────────────────────────────────────────────────────

function EncontroExtraDialog({
  open, onClose, courseId,
}: {
  open: boolean; onClose: () => void; courseId: string
}) {
  const router = useRouter()
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [time, setTime] = useState("10:00")
  const [pending, start] = useTransition()

  function salvar() {
    start(async () => {
      try {
        ouFalhe(await addCourseLessonAction({ courseId, date, time }))
        toast.success("Encontro adicionado à turma")
        onClose()
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Erro ao adicionar encontro")) }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-primary" />
            Encontro extra
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Uma reposição ou aula de revisão fora da grade. Entra com todos os alunos matriculados e
          não gera cobrança — o contrato já cobre.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Horário</Label>
            <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-9" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={salvar} disabled={pending}>
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Remover aluno da turma ───────────────────────────────────────────────────

export function RemoverAlunoButton({
  courseId, studentId, studentName,
}: {
  courseId: string; studentId: string; studentName: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function remover() {
    if (!confirm(
      `Tirar ${studentName} da turma? Sai dos encontros futuros e as cobranças ainda não pagas são apagadas. ` +
      `O histórico de aulas já dadas fica.`
    )) return

    start(async () => {
      try {
        ouFalhe(await unenrollStudentAction(courseId, studentId))
        toast.success(`${studentName} saiu da turma`)
        router.refresh()
      } catch (e) { toast.error(mensagemDeErro(e, "Erro ao remover aluno")) }
    })
  }

  return (
    <Button
      size="sm" variant="ghost" onClick={remover} disabled={pending}
      className="h-8 text-xs text-destructive hover:bg-destructive/10"
    >
      {pending
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <><UserMinus className="w-3.5 h-3.5 mr-1" /> Remover</>}
    </Button>
  )
}
