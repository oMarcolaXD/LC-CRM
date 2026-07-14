-- Revamp financeiro:
--  1. Taxas de cartão/maquininha configuráveis (por método + faixa de parcelas)
--  2. Snapshot da taxa por cobrança (receita líquida = amount - feeAmount)
--  3. Janela de dias de pagamento do repasse por professor

-- 1. Snapshot de taxa por cobrança
ALTER TABLE "payments" ADD COLUMN "feeAmount" DECIMAL(10,2);

-- 2. Janela de pagamento do repasse (dias do mês) por professor
ALTER TABLE "teachers" ADD COLUMN "payDayStart" INTEGER;
ALTER TABLE "teachers" ADD COLUMN "payDayEnd" INTEGER;

-- 3. Config de taxas por método + faixa de nº de parcelas
CREATE TABLE "card_fee_rates" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "minInstallments" INTEGER NOT NULL DEFAULT 1,
    "maxInstallments" INTEGER NOT NULL DEFAULT 1,
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_fee_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "card_fee_rates_method_idx" ON "card_fee_rates"("method");
