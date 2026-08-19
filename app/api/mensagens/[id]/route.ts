import { NextResponse } from 'next/server'
import { db } from '@/db'
import { mensagens, sessoes, emails } from '@/db/schemas/specemail'
import { eq, and, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

async function getUsuario() {
  const cookieStore = await cookies()
  const token = cookieStore.get('specemail_token')?.value
  if (!token) return null
  const agora = new Date()
  const sessao = await db.select().from(sessoes)
    .where(and(eq(sessoes.token, token), gt(sessoes.expiraEm, agora))).limit(1)
  if (!sessao.length) return null
  const usuario = await db.select().from(emails).where(eq(emails.id, sessao[0].emailId)).limit(1)
  return usuario[0] ?? null
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuario()
    if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    const { id } = await params
    const body = await request.json()
    const updated = await db.update(mensagens)
      .set({ lida: body.lida ?? true, pasta: body.pasta ?? undefined })
      .where(eq(mensagens.id, parseInt(id)))
      .returning()
    return NextResponse.json(updated[0])
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuario()
    if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    const { id } = await params
    const mensagem = await db.select().from(mensagens).where(eq(mensagens.id, parseInt(id))).limit(1)
    if (!mensagem.length || (mensagem[0].paraEmail !== usuario.email && mensagem[0].deEmailId !== usuario.id)) {
      return NextResponse.json({ erro: 'Mensagem não encontrada.' }, { status: 404 })
    }

    if (mensagem[0].pasta === 'lixeira') {
      await db.delete(mensagens).where(eq(mensagens.id, parseInt(id)))
      return NextResponse.json({ mensagem: 'Excluído definitivamente.' })
    }

    await db.update(mensagens).set({ pasta: 'lixeira' }).where(eq(mensagens.id, parseInt(id)))
    return NextResponse.json({ mensagem: 'Movido para a lixeira.' })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
