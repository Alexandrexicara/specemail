import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const PAGBANK_TOKEN = '16a9aa69-d7e4-42c7-9688-ed95ac1e47cf5b77fe6e4bb0b273825a39cf3919dc700987-52dd-45fa-9d9c-29137dd10a7c'

// Webhook PagBank — confirma pagamento e libera acesso
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const event = body.event
    const orderId = body.data?.id ?? body.id ?? ''

    if ((event === 'CHARGE_PAID' || event === 'ORDER_PAID' || event === 'ORDER.PAID') && orderId) {
      await db.update(emails)
        .set({ statusPagamento: 'pago', ativo: true })
        .where(eq(emails.pagbankOrderId, orderId))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

// Consulta manual de status — o frontend faz polling a cada 5s
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('emailId')
    if (!emailId) return NextResponse.json({ erro: 'emailId obrigatório.' }, { status: 400 })

    const rows = await db.select({
      id: emails.id,
      statusPagamento: emails.statusPagamento,
      pagbankOrderId: emails.pagbankOrderId,
    }).from(emails).where(eq(emails.id, parseInt(emailId))).limit(1)

    if (!rows.length) return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 })

    const u = rows[0]

    // Se ainda pendente e tem orderId, consultar status do order no PagBank
    if (u.statusPagamento === 'pendente' && u.pagbankOrderId) {
      try {
        const resp = await fetch(`https://sandbox.api.pagseguro.com/orders/${u.pagbankOrderId}`, {
          headers: { Authorization: `Bearer ${PAGBANK_TOKEN}` },
        })
        const orderData = await resp.json()
        // Order pago quando todos os qr_codes/charges estão PAID
        const pago =
          orderData.qr_codes?.every((q: { status?: string }) => q.status === 'PAID') ||
          orderData.charges?.every((c: { status?: string }) => c.status === 'PAID') ||
          orderData.status === 'PAID'

        if (pago) {
          await db.update(emails)
            .set({ statusPagamento: 'pago', ativo: true })
            .where(eq(emails.id, parseInt(emailId)))
          return NextResponse.json({ statusPagamento: 'pago' })
        }
      } catch { /* ignora — retorna status atual */ }
    }

    return NextResponse.json({ statusPagamento: u.statusPagamento })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
