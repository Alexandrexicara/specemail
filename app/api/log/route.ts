import { NextResponse } from 'next/server'
import { appendFileSync } from 'fs'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const body = await request.json()
    appendFileSync('/tmp/spece-client.log', `${new Date().toISOString()} ${JSON.stringify(body)}\n`)
  } catch {}
  return NextResponse.json({ ok: true })
}
