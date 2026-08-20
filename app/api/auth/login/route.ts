import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails, sessoes } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(senha + 'specemail_salt')).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  )
}

function gerarToken(): string {
  const arr = new Uint8Array(48)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: Request) {
  try {
    const { email, senha } = await request.json()
    if (!email || !senha) {
      return NextResponse.json({ erro: 'Informe e-mail e senha.' }, { status: 400 })
    }

    const emailNormalizado = email.toLowerCase()
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    const adminPassword = process.env.ADMIN_PASSWORD

    if (adminEmail && adminPassword && emailNormalizado === adminEmail && senha === adminPassword) {
      const senhaCripto = await hashSenha(adminPassword)
      const existingAdmin = await db.select().from(emails).where(eq(emails.email, adminEmail)).limit(1)

      if (existingAdmin.length === 0) {
        await db.insert(emails).values({
          nome: 'Administrador',
          email: adminEmail,
          senha: senhaCripto,
          cargo: 'admin',
          ativo: true,
          statusPagamento: 'pago',
        })
      } else {
        await db.update(emails).set({
          senha: senhaCripto,
          cargo: 'admin',
          ativo: true,
          statusPagamento: 'pago',
        }).where(eq(emails.email, adminEmail))
      }
    }

    const rows = await db.select().from(emails).where(eq(emails.email, emailNormalizado)).limit(1)
    if (rows.length === 0) {
      return NextResponse.json({ erro: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    const usuario = rows[0]
    const senhaCripto = await hashSenha(senha)
    if (usuario.senha !== senhaCripto) {
      return NextResponse.json({ erro: 'E-mail ou senha incorretos.' }, { status: 401 })
    }

    if (!usuario.ativo) {
      return NextResponse.json({ erro: 'Conta desativada. Entre em contato com o suporte.' }, { status: 403 })
    }

    if (usuario.statusPagamento !== 'pago') {
      return NextResponse.json({
        erro: 'pagamento_pendente',
        emailId: usuario.id,
        mensagem: 'Pagamento pendente. Conclua o pagamento para acessar seu e-mail.',
      }, { status: 402 })
    }

    // Criar sessão (7 dias)
    const token = gerarToken()
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await db.insert(sessoes).values({ emailId: usuario.id, token, expiraEm: expira })

    const response = NextResponse.json({
      mensagem: 'Login realizado!',
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo },
    })
    response.cookies.set('specemail_token', token, {
      httpOnly: true, sameSite: 'lax', path: '/',
      expires: expira,
    })
    return response
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
