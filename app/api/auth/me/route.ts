import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sessoes, emails } from '@/db/schemas/specemail'
import { eq, and, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('specemail_token')?.value
    if (!token) return NextResponse.json({ usuario: null })

    const agora = new Date()
    const sessao = await db
      .select()
      .from(sessoes)
      .where(and(eq(sessoes.token, token), gt(sessoes.expiraEm, agora)))
      .limit(1)

    if (sessao.length === 0) return NextResponse.json({ usuario: null })

    const usuario = await db.select().from(emails).where(eq(emails.id, sessao[0].emailId)).limit(1)
    if (usuario.length === 0) return NextResponse.json({ usuario: null })

    const u = usuario[0]
    return NextResponse.json({
      usuario: { id: u.id, nome: u.nome, email: u.email, cargo: u.cargo, statusPagamento: u.statusPagamento },
    })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
