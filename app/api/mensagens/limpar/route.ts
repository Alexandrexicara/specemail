import { NextResponse } from 'next/server'
import { db } from '@/db'
import { mensagens, sessoes, emails } from '@/db/schemas/specemail'
import { eq, and, gt, or } from 'drizzle-orm'
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

export async function DELETE(request: Request) {
  try {
    const usuario = await getUsuario()
    if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const pasta = searchParams.get('pasta') || 'entrada'

    // A entrada vai para a lixeira; a lixeira é apagada definitivamente.
    if (pasta === 'entrada') {
      await db.update(mensagens).set({ pasta: 'lixeira' }).where(
        and(eq(mensagens.paraEmail, usuario.email), eq(mensagens.pasta, 'entrada'))
      )
    } else if (pasta === 'lixeira') {
      await db.delete(mensagens).where(
        and(
          eq(mensagens.pasta, 'lixeira'),
          or(eq(mensagens.paraEmail, usuario.email), eq(mensagens.deEmailId, usuario.id)),
        )
      )
    } else {
      await db.update(mensagens).set({ pasta: 'lixeira' }).where(
        and(eq(mensagens.deEmailId, usuario.id), eq(mensagens.pasta, pasta))
      )
    }

    return NextResponse.json({ mensagem: `Pasta "${pasta}" limpa com sucesso!` })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
