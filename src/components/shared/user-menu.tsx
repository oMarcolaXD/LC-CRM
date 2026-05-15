"use client"

import { useState, useTransition, useRef }        from "react"
import { signOut, useSession }                     from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage }     from "@/components/ui/avatar"
import { Button }                                  from "@/components/ui/button"
import { Input }                                   from "@/components/ui/input"
import { Label }                                   from "@/components/ui/label"
import { Badge }                                   from "@/components/ui/badge"
import { Separator }                               from "@/components/ui/separator"
import {
  Sheet, SheetContent, SheetHeader,
  SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Camera, ChevronRight, Lock, LogOut,
  Phone, User, CheckCircle, AlertCircle,
} from "lucide-react"
import { updateProfileAction } from "@/lib/actions/profile"

const ROLE_LABEL: Record<string, string> = {
  ADMIN:        "Administrador",
  COLLABORATOR: "Colaborador",
  TEACHER:      "Professor",
  STUDENT:      "Aluno",
  GUARDIAN:     "Responsável",
}

interface UserMenuProps {
  name:   string
  email:  string
  role:   string
  image?: string | null
}

export function UserMenu({ name: initialName, email, role, image: initialImage }: UserMenuProps) {
  const { update: updateSession } = useSession()

  const [sheetOpen,       setSheetOpen]       = useState(false)
  const [name,            setName]            = useState(initialName)
  const [phone,           setPhone]           = useState("")
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(initialImage ?? null)
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
        const canvas  = document.createElement("canvas")
        canvas.width  = 200
        canvas.height = 200
        const ctx     = canvas.getContext("2d")!
        const size    = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 200, 200)
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
    const fd = new FormData()
    fd.set("name",  name)
    fd.set("phone", phone)
    if (avatarBase64)    fd.set("avatar",          avatarBase64)
    if (currentPassword) fd.set("currentPassword", currentPassword)
    if (newPassword)     fd.set("newPassword",     newPassword)

    startTransition(async () => {
      const result = await updateProfileAction(fd)
      if (result.error) {
        setMessage({ type: "error", text: result.error })
      } else {
        setMessage({ type: "success", text: result.success! })
        setCurrentPassword("")
        setNewPassword("")
        setAvatarBase64(null)
        await updateSession({ name, image: avatarBase64 ?? initialImage })
      }
    })
  }

  return (
    <>
      {/* Trigger no rodapé da sidebar */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left outline-none">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={avatarPreview ?? undefined} alt={name} />
            <AvatarFallback className="bg-primary text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{ROLE_LABEL[role]}</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
          <DropdownMenuLabel>
            <p className="font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground font-normal truncate">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setSheetOpen(true) }}>
            <User className="w-4 h-4 mr-2" />
            Editar perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sheet de edição de perfil */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle className="font-heading text-lg">Meu Perfil</SheetTitle>
            <SheetDescription className="text-xs">
              Edite sua foto, nome, telefone ou senha.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-6">

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-16 h-16 ring-2 ring-primary/20">
                    <AvatarImage src={avatarPreview ?? undefined} alt={name} />
                    <AvatarFallback className="bg-primary text-white text-xl font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{name}</p>
                    <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 text-xs">
                      {ROLE_LABEL[role]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{email}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 mt-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-3 h-3" />
                    Trocar foto
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <Separator />

              {/* Dados pessoais */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Dados Pessoais
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-name">Nome completo</Label>
                  <Input
                    id="sheet-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-email">E-mail</Label>
                  <Input id="sheet-email" value={email} disabled className="opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-muted-foreground">Apenas o administrador pode alterar o e-mail.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-phone" className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="sheet-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <Separator />

              {/* Alterar senha */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Alterar Senha
                  <span className="ml-auto normal-case font-normal">opcional</span>
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="sheet-current-pw">Senha atual</Label>
                  <Input
                    id="sheet-current-pw"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sheet-new-pw">Nova senha</Label>
                  <Input
                    id="sheet-new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

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
            </div>

            {/* Footer fixo */}
            <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setSheetOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
