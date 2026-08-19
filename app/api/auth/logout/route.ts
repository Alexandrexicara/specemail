import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sessoes } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('specemail_token')?.value
    if (token) {
      await db.delete(sessoes).where(eq(sessoes.token, token))
    }
    const response = NextResponse.json({ mensagem: 'Logout realizado.' })
    response.cookies.set('specemail_token', '', { expires: new Date(0), path: '/' })
    return response
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
