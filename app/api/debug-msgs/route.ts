import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails, mensagens } from '@/db/schemas/specemail'
import { desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  const e = await db.select({ id: emails.id, email: emails.email, nome: emails.nome, status: emails.statusPagamento, ativo: emails.ativo }).from(emails)
  const m = await db.select().from(mensagens).orderBy(desc(mensagens.criadoEm)).limit(20)
  return NextResponse.json({
    emails: e,
    mensagens: m.map(x => ({ id: x.id, de: x.deEmail, para: x.paraEmail, pasta: x.pasta, assunto: x.assunto, corpo: x.corpo?.substring(0, 100) }))
  })
}
