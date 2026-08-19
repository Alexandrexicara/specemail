import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { prompt, contexto } = await request.json()

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ erro: 'Informe o prompt.' }, { status: 400 })
    }

    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json({ erro: 'NVIDIA_API_KEY não configurada.' }, { status: 503 })
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'Você é um assistente de e-mail objetivo. Não invente informações.' },
          ...(typeof contexto === 'string' && contexto.trim() ? [{ role: 'user' as const, content: contexto }] : []),
          { role: 'user', content: prompt.trim() },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ erro: 'A NVIDIA recusou a solicitação.', detalhe: data }, { status: 502 })
    }

    return NextResponse.json({ resposta: data.choices?.[0]?.message?.content || '' })
  } catch (error) {
    const mensagem = error instanceof Error && error.name === 'TimeoutError'
      ? 'A NVIDIA demorou para responder.'
      : 'Não foi possível consultar a NVIDIA.'
    return NextResponse.json({ erro: mensagem }, { status: 502 })
  }
}