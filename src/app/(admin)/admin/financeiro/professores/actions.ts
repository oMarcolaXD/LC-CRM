"use server"

import { generatePayoutAction } from "@/lib/actions/financeiro"

export async function generatePayoutFormAction(formData: FormData) {
  await generatePayoutAction(
    formData.get("teacherId") as string,
    Number(formData.get("month")),
    Number(formData.get("year")),
  )
}
