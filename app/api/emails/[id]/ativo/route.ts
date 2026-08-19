import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { ativo } = body

    const updated = await db
      .update(emails)
      .set({ ativo })
      .where(eq(emails.id, parseInt(id)))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ erro: 'Não encontrado!' }, { status: 404 })
    }
    return NextResponse.json({ mensagem: 'Status atualizado!', dados: updated[0] })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
