import { NextRequest, NextResponse } from "next/server"
import { auth }                      from "@/lib/auth"

const PROMPT_EXTRACAO = `Você está analisando uma ficha de cadastro de aluno de uma empresa de aulas particulares chamada Lição de Casa.

Extraia TODOS os dados visíveis na ficha e retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem explicações.

O JSON deve seguir exatamente esta estrutura:
{
  "aluno": {
    "nome": "",
    "ano": "",
    "colegio": "",
    "contato": "",
    "responsavel": ""
  },
  "pacotes": [
    {
      "tipo": "",
      "dataInicio": "",
      "valor": "",
      "dataFim": "",
      "pagamento": ""
    }
  ],
  "observacoes": "",
  "confianca": "alta|media|baixa"
}

Regras:
- Se um campo não estiver visível ou legível, deixe como string vazia ""
- Para "pacotes", inclua apenas as linhas da tabela que tiverem algum dado preenchido
- Para "dataInicio" e "dataFim", mantenha o formato exatamente como está na ficha
- Para "valor", mantenha o formato exatamente como está (ex: "R$ 150,00" ou "150")
- Para "confianca": use "alta" se leu tudo claramente, "media" se houve partes difíceis, "baixa" se a imagem estava ruim
- Em "observacoes", descreva brevemente qualquer dificuldade encontrada na leitura
- Nunca invente dados — prefira deixar vazio a adivinhar`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  let base64: string
  let mimeType: string

  try {
    const body = await req.json()
    base64    = body.base64
    mimeType  = body.mimeType ?? "image/jpeg"

    if (!base64) {
      return NextResponse.json({ error: "Imagem não recebida" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Serviço de leitura indisponível. Preencha manualmente ou tente novamente." },
      { status: 503 }
    )
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type:       "base64",
                  media_type: mimeType,
                  data:       base64,
                },
              },
              {
                type: "text",
                text: PROMPT_EXTRACAO,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error("[digitalizar-ficha] Anthropic API error:", errText)
      return NextResponse.json(
        { error: "Serviço de leitura indisponível. Preencha manualmente ou tente novamente." },
        { status: 502 }
      )
    }

    const anthropicData = await anthropicRes.json()
    const rawText = anthropicData.content?.[0]?.text ?? ""

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim()

    let dados
    try {
      dados = JSON.parse(cleaned)
    } catch {
      // If the model returned an empty-looking description, treat as blank ficha
      if (rawText.toLowerCase().includes("vazi") || rawText.toLowerCase().includes("blank")) {
        return NextResponse.json(
          { error: "A ficha parece estar vazia. Verifique a imagem enviada." },
          { status: 422 }
        )
      }
      return NextResponse.json(
        { error: "Não consegui ler a ficha. Tente uma foto com mais luz ou ângulo reto." },
        { status: 422 }
      )
    }

    // Validate minimum structure
    if (!dados.aluno || typeof dados.aluno !== "object") {
      return NextResponse.json(
        { error: "Não consegui ler a ficha. Tente uma foto com mais luz ou ângulo reto." },
        { status: 422 }
      )
    }

    if (!Array.isArray(dados.pacotes)) dados.pacotes = []

    return NextResponse.json({ sucesso: true, dados })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "A análise demorou demais. Tente uma imagem menor ou preencha manualmente." },
        { status: 408 }
      )
    }
    console.error("[digitalizar-ficha] Unexpected error:", err)
    return NextResponse.json(
      { error: "Serviço de leitura indisponível. Preencha manualmente ou tente novamente." },
      { status: 500 }
    )
  }
}
