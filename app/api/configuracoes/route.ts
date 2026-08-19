import { NextResponse } from 'next/server'
import { db } from '@/db'
import { configuracoes } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await db.select().from(configuracoes).where(eq(configuracoes.id, 1)).limit(1)
    if (rows.length === 0) {
      const inserted = await db
        .insert(configuracoes)
        .values({ nomeEmpresa: 'Minha Empresa' })
        .returning()
      return NextResponse.json(inserted[0])
    }
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nomeEmpresa, site, whatsapp, instagram, facebook, emailContato } = body

    const rows = await db.select().from(configuracoes).where(eq(configuracoes.id, 1)).limit(1)

    if (rows.length === 0) {
      const inserted = await db
        .insert(configuracoes)
        .values({ nomeEmpresa, site, whatsapp, instagram, facebook, emailContato, atualizadoEm: new Date() })
        .returning()
      return NextResponse.json({ mensagem: 'Salvo!', dados: inserted[0] })
    }

    const updated = await db
      .update(configuracoes)
      .set({ nomeEmpresa, site, whatsapp, instagram, facebook, emailContato, atualizadoEm: new Date() })
      .where(eq(configuracoes.id, 1))
      .returning()
    return NextResponse.json({ mensagem: 'Salvo!', dados: updated[0] })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
