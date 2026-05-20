"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface UserRoleTabsProps {
  counts: Record<string, number>
  total:  number
}

const ROLE_TABS = [
  { label: "Todos",         value: ""             },
  { label: "Admins",        value: "ADMIN"        },
  { label: "Colaboradores", value: "COLLABORATOR" },
  { label: "Professores",   value: "TEACHER"      },
  { label: "Alunos",        value: "STUDENT"      },
  { label: "Responsáveis",  value: "GUARDIAN"     },
]

export function UserRoleTabs({ counts, total }: UserRoleTabsProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const current      = searchParams.get("role") ?? ""
  const q            = searchParams.get("q")

  function handleChange(value: string) {
    const params = new URLSearchParams()
    if (value) params.set("role", value)
    if (q)     params.set("q", q)
    router.push(`/admin/usuarios${params.size ? `?${params}` : ""}`)
  }

  return (
    <Tabs value={current} onValueChange={handleChange} className="mb-4">
      <TabsList className="h-auto flex-wrap gap-1 bg-muted p-1">
        {ROLE_TABS.map(({ label, value }) => (
          <TabsTrigger key={value} value={value} className="text-xs px-3 py-1">
            {label}
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              ({value ? (counts[value] ?? 0) : total})
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
