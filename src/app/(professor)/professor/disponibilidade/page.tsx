import { auth }        from "@/lib/auth"
import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AvailabilityForm } from "./availability-form"
import type { Availability } from "@/lib/availability"

export default async function DisponibilidadePage() {
  const session = await auth()
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session?.user?.email ?? "" } },
  })

  const availability = (teacher?.availability ?? {}) as unknown as Availability

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="MINHA DISPONIBILIDADE"
        description="Defina os dias e horários em que você aceita aulas"
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base">Horários Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityForm initial={availability} />
        </CardContent>
      </Card>
    </div>
  )
}
