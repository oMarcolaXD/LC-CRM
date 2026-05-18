import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const PROD_DB_ID = "jdrjbxusfvlqwbzbrqgf"
if ((process.env.DATABASE_URL ?? "").includes(PROD_DB_ID)) {
  console.error("❌ BLOQUEADO: seed não pode rodar no banco de PRODUÇÃO.")
  process.exit(1)
}

const adminPassword = process.env.SEED_ADMIN_PASSWORD
if (!adminPassword) {
  console.error("❌ SEED_ADMIN_PASSWORD não está definida no .env")
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "espacolicao@gmail.com" } })
  if (existing) {
    console.log("✅ Admin já existe no banco.")
    console.log("   Atualizando senha para garantir...")
    await prisma.user.update({
      where: { email: "espacolicao@gmail.com" },
      data: { password: await bcrypt.hash(adminPassword, 12), active: true, role: Role.ADMIN },
    })
    console.log("✅ Senha atualizada com sucesso!")
    return
  }

  await prisma.user.create({
    data: {
      name:     "Administrador",
      email:    "espacolicao@gmail.com",
      password: await bcrypt.hash(adminPassword, 12),
      role:     Role.ADMIN,
      active:   true,
    },
  })
  console.log("✅ Admin criado com sucesso!")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
