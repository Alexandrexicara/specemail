import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails } from '@/db/schemas/specemail'
import { desc, count } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await db.select().from(emails).orderBy(desc(emails.criadoEm))
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, email, senha, cargo, cpf } = body

    if (!nome || !email || !senha) {
      return NextResponse.json({ erro: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    // Regra: máximo 1 e-mail cadastrado por vez
    const [{ total }] = await db.select({ total: count() }).from(emails)
    if (Number(total) >= 1) {
      return NextResponse.json({
        erro: 'Já existe um e-mail cadastrado. Exclua o e-mail atual antes de criar um novo.',
      }, { status: 400 })
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(senha + 'specemail_salt')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const senhaCripto = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const inserted = await db
      .insert(emails)
      .values({
        nome,
        email: email.toLowerCase(),
        senha: senhaCripto,
        cargo: cargo || '',
        cpf: (cpf || '').replace(/\D/g, ''),
        statusPagamento: 'pendente',
        ativo: false,
      })
      .returning({
        id: emails.id,
        nome: emails.nome,
        email: emails.email,
        cargo: emails.cargo,
        cpf: emails.cpf,
        ativo: emails.ativo,
        statusPagamento: emails.statusPagamento,
        criadoEm: emails.criadoEm,
      })

    return NextResponse.json({
      mensagem: 'E-mail criado! Conclua o pagamento para ativar.',
      dados: inserted[0],
      precisaPagar: true,
    })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
      return NextResponse.json({ erro: 'E-mail já cadastrado!' }, { status: 400 })
    }
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
