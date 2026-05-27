import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import Link            from "next/link"
import { Wifi, MapPin, LayoutGrid, ChevronRight, UserCircle } from "lucide-react"

const MODE_LABEL = { ONLINE_ONLY: "Só Online", PRESENCIAL: "Presencial", HYBRID: "Presencial e Online" }
const MODE_COLOR = {
  ONLINE_ONLY: "bg-blue-100 text-blue-700",
  PRESENCIAL:  "bg-green-100 text-green-700",
  HYBRID:      "bg-orange-100 text-orange-700",
}
const MODE_ICON  = {
  ONLINE_ONLY: <Wifi className="w-3 h-3" />,
  PRESENCIAL:  <MapPin className="w-3 h-3" />,
  HYBRID:      <LayoutGrid className="w-3 h-3" />,
}

const LEVEL_LABEL: Record<string, string> = {
  EF2: "Fund. 2", EM: "Ens. Médio", SUPERIOR: "Superior", VESTIBULAR: "Vestibular",
}

export default async function AdminProfessoresPage() {
  const teachers = await prisma.teacher.findMany({
    where:   { user: { active: true } },
    include: {
      user:     true,
      subjects: { include: { subject: true } },
    },
    orderBy: { user: { name: "asc" } },
  })

  return (
    <div>
      <PageHeader
        title="PROFESSORES"
        description={`${teachers.length} professor${teachers.length !== 1 ? "es" : ""} ativo${teachers.length !== 1 ? "s" : ""}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teachers.map((t) => {
          const mode = t.teachingMode as keyof typeof MODE_LABEL
          return (
            <Link key={t.id} href={`/admin/professores/${t.id}`} className="group block">
              <Card className="h-full hover:border-primary/40 hover:shadow-sm transition-all">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {t.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.user.avatar} alt={t.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-7 h-7 text-primary/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">{t.user.name}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.user.email}</p>

                      <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${MODE_COLOR[mode]}`}>
                        {MODE_ICON[mode]} {MODE_LABEL[mode]}
                      </span>
                    </div>
                  </div>

                  {t.bio && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{t.bio}</p>
                  )}

                  {t.subjects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.subjects.map((ts) => (
                        <div key={ts.subjectId} className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-[11px]">{ts.subject.name}</Badge>
                          {ts.levels.map((l) => (
                            <span key={l} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {LEVEL_LABEL[l] ?? l}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
