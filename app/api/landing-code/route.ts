import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'landing.html')
  const content = fs.readFileSync(filePath, 'utf-8')
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
