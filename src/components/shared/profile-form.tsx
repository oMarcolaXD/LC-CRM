"use client"

import { useState, useTransition, useRef } from "react"
import { useSession }   from "next-auth/react"
import { updateProfileAction } from "@/lib/actions/profile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button }       from "@/components/ui/button"
import { Input }        from "@/components/ui/input"
import { Label }        from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PhoneInput } from "@/components/ui/phone-input"
import { Badge }        from "@/components/ui/badge"
import { Camera, User, Phone, Lock, CheckCircle, AlertCircle, Mail } from "lucide-react"
import { format }       from "date-fns"
import { ptBR }         from "date-fns/locale"

const ROLE_LABEL: Record<string, string> = {
  ADMIN:        "Administrador",
  COLLABORATOR: "Colaborador",
  TEACHER:      "Professor",
  STUDENT:      "Aluno",
  GUARDIAN:     "Responsável",
}

interface ProfileUser {
  id:        string
  name:      string
  email:     string | null
  phone:     string | null
  avatar:    string | null
  role:      string
  createdAt: Date
}

export function ProfileForm({ user }: { user: ProfileUser }) {
  const { update: updateSession } = useSession()

  const [name,            setName]            = useState(user.name)
  const [emailValue,      setEmailValue]      = useState(user.email ?? "")
  const [phone,           setPhone]           = useState(user.phone ?? "")
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(user.avatar)
  const [avatarBase64,    setAvatarBase64]    = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword,     setNewPassword]     = useState("")
  const [message,         setMessage]         = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isPending,       startTransition]    = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas   = document.createElement("canvas")
        canvas.width   = 200
        canvas.height  = 200
        const ctx      = canvas.getContext("2d")!
        const size     = Math.min(img.width, img.height)
        const sx       = (img.width  - size) / 2
        const sy       = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200)
        const base64 = canvas.toDataURL("image/jpeg", 0.82)
        setAvatarPreview(base64)
        setAvatarBase64(base64)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.set("name",  name)
    formData.set("email", emailValue)
    formData.set("phone", phone)
    if (avatarBase64)    formData.set("avatar",          avatarBase64)
    if (currentPassword) formData.set("currentPassword", currentPassword)
    if (newPassword)     formData.set("newPassword",     newPassword)

    startTransition(async () => {
      const result = await updateProfileAction(formData)
      if (result.error) {
        setMessage({ type: "error", text: result.error })
      } else if (result.success) {
        setMessage({ type: "success", text: result.success })
        setCurrentPassword("")
        setNewPassword("")
        setAvatarBase64(null)
        await updateSession({ name, image: avatarBase64 ?? user.avatar })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Avatar + info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar com hover para trocar */}
            <div className="relative group shrink-0">
              <Avatar className="w-24 h-24 ring-2 ring-primary/20">
                <AvatarImage src={avatarPreview ?? undefined} alt={name} />
                <AvatarFallback className="bg-primary text-white text-2xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Trocar foto"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <p className="font-semibold text-lg leading-tight">{user.name}</p>
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 text-xs">
                  {ROLE_LABEL[user.role]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                Membro desde {format(user.createdAt, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 mt-1"
              >
                <Camera className="w-3.5 h-3.5" />
                Trocar foto
              </Button>
              <p className="text-xs text-muted-foreground">JPG ou PNG · a foto será redimensionada para 200×200px</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dados pessoais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              placeholder="seu@email.com"
            />
            {!user.email && (
              <p className="text-xs text-[#FB8500]">Cadastre um e-mail para facilitar o login e confirmar sua conta.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Telefone / WhatsApp
            </Label>
            <PhoneInput
              id="phone"
              value={phone}
              onChange={(raw) => setPhone(raw)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Alterar Senha
            <span className="ml-auto text-xs font-normal text-muted-foreground">opcional</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
          message.type === "success"
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {message.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle  className="w-4 h-4 shrink-0" />
          }
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="px-8">
          {isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

    </form>
  )
}
