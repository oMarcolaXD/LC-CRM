// Script de teste manual da integração com Evolution API
// Uso: npx tsx --env-file=.env.local scripts/test-whatsapp.ts <telefone>
// Ex:  npx tsx --env-file=.env.local scripts/test-whatsapp.ts 11999999999

import { sendWhatsApp } from "../src/lib/notifications/whatsapp"

const phone = process.argv[2]

if (!phone) {
  console.error("Uso: npx tsx --env-file=.env.local scripts/test-whatsapp.ts <telefone>")
  process.exit(1)
}

sendWhatsApp({
  userId:  "test",
  type:    "LESSON_REMINDER_24H",
  title:   "Teste de integração",
  message: "Esta é uma mensagem de teste da Evolution API. 🎉",
  phone,
}).then(() => {
  console.log("Mensagem enviada (verifique o WhatsApp).")
})
