import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails, mensagens } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

type InboundMessage = {
  to?: string
  from?: string
  sender?: string
  subject?: string
  text?: string
  html?: string
  message?: string
}

function firstAddress(value: unknown) {
  if (typeof value !== 'string') return ''
  const match = value.match(/<?([\w.+-]+@[\w.-]+\.[a-z]{2,})>?/i)
  return match?.[1]?.toLowerCase() || ''
}

export async function POST(request: Request) {
  const secret = process.env.EMAIL_INBOUND_SECRET
  if (!secret || request.headers.get('x-inbound-secret') !== secret) {
    return NextResponse.json({ erro: 'Webhook não autorizado.' }, { status: 401 })
  }

  try {
    const body = await request.json() as InboundMessage
    const destinatario = firstAddress(body.to) || process.env.EMAIL_INBOUND_ADDRESS?.toLowerCase() || ''
    const remetente = firstAddress(body.from || body.sender)
    const assunto = body.subject?.trim() || '(Sem assunto)'
    const corpo = body.text?.trim() || body.html?.replace(/<[^>]+>/g, ' ').trim() || body.message?.trim() || ''

    if (!destinatario || !remetente || !corpo) {
      return NextResponse.json({ erro: 'Mensagem recebida sem destinatário, remetente ou corpo.' }, { status: 400 })
    }

    const destino = await db.select({ id: emails.id, email: emails.email, nome: emails.nome })
      .from(emails).where(eq(emails.email, destinatario)).limit(1)
    if (!destino.length) return NextResponse.json({ erro: 'Destinatário não encontrado.' }, { status: 404 })

    await db.insert(mensagens).values({
      deEmailId: destino[0].id,
      deEmail: remetente,
      deNome: remetente,
      paraEmail: destino[0].email,
      assunto,
      corpo,
      pasta: 'entrada',
      lida: false,
      anexos: '[]',
    })

    return NextResponse.json({ mensagem: 'E-mail recebido.' }, { status: 201 })
  } catch {
    return NextResponse.json({ erro: 'Não foi possível processar o e-mail recebido.' }, { status: 400 })
  }
}