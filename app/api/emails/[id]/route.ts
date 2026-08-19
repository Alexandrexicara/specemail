import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(emails).where(eq(emails.id, parseInt(id)))
    return NextResponse.json({ mensagem: 'Excluído!' })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
