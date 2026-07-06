"use client"

import { useState, useTransition } from "react"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createMaterialAction } from "@/lib/actions/material"
import { Plus, Loader2 } from "lucide-react"

const FILE_TYPES = ["PDF", "Vídeo", "Link", "Apresentação", "Documento", "Áudio"]

interface Student { id: string; name: string }
interface Subject { id: string; name: string }

interface MaterialFormProps {
  students: Student[]
  subjects: Subject[]
}

export function MaterialForm({ students, subjects }: MaterialFormProps) {
  const [title,     setTitle]     = useState("")
  const [fileUrl,   setFileUrl]   = useState("")
  const [fileType,  setFileType]  = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [studentId, setStudentId] = useState("")
  const [pending,   start]        = useTransition()

  const reset = () => {
    setTitle(""); setFileUrl(""); setFileType("")
    setSubjectId(""); setStudentId("")
  }

  const handle = () => {
    if (!title || !fileUrl || !fileType) return
    start(async () => {
      await createMaterialAction(
        title,
        fileUrl,
        fileType,
        subjectId || undefined,
        studentId || undefined,
      )
      reset()
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Título *</Label>
        <Input
          placeholder="Ex: Lista de exercícios cap. 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">URL do material *</Label>
        <Input
          type="url"
          placeholder="https://drive.google.com/..."
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tipo *</Label>
        <Select value={fileType} onValueChange={(v) => setFileType(v ?? "")}>
          <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
          <SelectContent>
            {FILE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {subjects.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Matéria (opcional)</Label>
          <Select value={subjectId} onValueChange={(v) => setSubjectId(v ?? "")}>
            <SelectTrigger>
              <SelectValue>
                {(v: unknown) => subjects.find(x => x.id === v)?.name ?? "Todas as matérias"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as matérias</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Aluno (opcional)</Label>
        <Select value={studentId} onValueChange={(v) => setStudentId(v ?? "")}>
          <SelectTrigger>
            <SelectValue>
              {(v: unknown) => students.find(x => x.id === v)?.name ?? "Todos os alunos"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os alunos</SelectItem>
            {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <Button
          className="w-full"
          disabled={pending || !title || !fileUrl || !fileType}
          onClick={handle}
        >
          {pending
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : <Plus className="w-4 h-4 mr-2" />}
          Adicionar
        </Button>
      </div>
    </div>
  )
}
