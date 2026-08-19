import { NextResponse } from 'next/server'
import { db } from '@/db'
import { emails } from '@/db/schemas/specemail'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const PAGBANK_URL = 'https://sandbox.api.pagseguro.com'
const PAGBANK_TOKEN = '16a9aa69-d7e4-42c7-9688-ed95ac1e47cf5b77fe6e4bb0b273825a39cf3919dc700987-52dd-45fa-9d9c-29137dd10a7c'

export async function POST(request: Request) {
  try {
    const { emailId } = await request.json()
    if (!emailId) return NextResponse.json({ erro: 'emailId obrigatório.' }, { status: 400 })

    const rows = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1)
    if (!rows.length) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })

    const usuario = rows[0]

    const cpfLimpo = (usuario.cpf || '').replace(/\D/g, '')
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return NextResponse.json({
        erro: 'CPF inválido ou não informado. Verifique o cadastro.',
      }, { status: 400 })
    }

    // PagBank: qr_codes e charges PIX não podem coexistir.
    // Usar apenas qr_codes para gerar PIX Copia e Cola + QR image.
    const orderPayload = {
      reference_id: `specemail-${usuario.id}-${Date.now()}`,
      customer: {
        name: usuario.nome,
        email: usuario.email,
        tax_id: cpfLimpo,
      },
      items: [
        {
          name: 'speceEMAIL Plano Basico',
          quantity: 1,
          unit_amount: 2000,
        },
      ],
      qr_codes: [
        {
          amount: { value: 2000 },
          expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      ],
    }

    const response = await fetch(`${PAGBANK_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAGBANK_TOKEN}`,
      },
      body: JSON.stringify(orderPayload),
    })

    const orderData = await response.json()

    if (!response.ok) {
      const msgs = orderData?.error_messages ?? orderData
      return NextResponse.json({
        erro: `Erro PagBank: ${JSON.stringify(msgs)}`,
      }, { status: 500 })
    }

    const orderId = orderData.id
    // qr_codes gera um id de charge interno — salvar o orderId para consulta
    await db.update(emails)
      .set({ pagbankOrderId: orderId, pagbankChargeId: '' })
      .where(eq(emails.id, emailId))

    const qrCode = orderData.qr_codes?.[0]
    const pixCopiaECola: string = qrCode?.text ?? ''
    const pixQrImageLink: string = qrCode?.links?.find((l: { rel: string }) => l.rel === 'QRCODE.PNG')?.href ?? ''
    const pixBase64: string = qrCode?.base64 ?? ''

    return NextResponse.json({
      orderId,
      pixCopiaECola,
      pixQrImage: pixQrImageLink || (pixBase64 ? `data:image/png;base64,${pixBase64}` : ''),
      valor: 'R$ 20,00',
    })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
