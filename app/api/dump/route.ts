import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails, mensagens } from '@/db/schemas/specemail'
import { desc } from 'drizzle-orm'

export const runtime = 'nodejs'
export async function GET() {
  const m = await db.select().from(mensagens).orderBy(desc(mensagens.criadoEm)).limit(50)
  const e = await db.select().from(emails)
  return NextResponse.json({
    emails: e.map((x) => ({ id: x.id, email: x.email, nome: x.nome, status: x.statusPagamento })),
    mensagens: m.map((x) => ({
      id: x.id, de: x.deEmail, para: x.paraEmail, pasta: x.pasta,
      assunto: x.assunto, corpo: x.corpo?.substring(0, 80), criadoEm: x.criadoEm,
    })),
  })
}
