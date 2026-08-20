import { NextResponse } from 'next/server'
import { db } from '@/db'
import { mensagens, sessoes, emails, configuracoes } from '@/db/schemas/specemail'
import { eq, and, gt, desc, or } from 'drizzle-orm'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const MAX_ANEXOS_BYTES = 10 * 1024 * 1024
const TIPOS_ANEXO_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

async function getUsuario() {
  const cookieStore = await cookies()
  const token = cookieStore.get('specemail_token')?.value
  if (!token) return null
  const agora = new Date()
  const sessao = await db.select().from(sessoes)
    .where(and(eq(sessoes.token, token), gt(sessoes.expiraEm, agora))).limit(1)
  if (!sessao.length) return null
  const usuario = await db.select().from(emails).where(eq(emails.id, sessao[0].emailId)).limit(1)
  return usuario[0] ?? null
}

async function enviarViaBrevo(opts: {
  deNome: string
  deEmail: string
  para: string
  assunto: string
  corpo: string
  anexos: Array<{ nome: string; tipo: string; tamanho?: number; base64: string }>
  baseUrl: string
}) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('Envio externo indisponível: configure BREVO_API_KEY no arquivo .env.')
  }

  const LOG = process.env.LOG_FILE || '/tmp/spece.log'
  const log = (msg: string) => {
    try { require('fs').appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`) } catch {}
  }
  // Busca as configurações da empresa (nome, redes sociais) para a assinatura
  let conf: {
    nomeEmpresa?: string | null; site?: string | null; whatsapp?: string | null
    instagram?: string | null; facebook?: string | null; emailContato?: string | null
  } = {}
  try {
    const rows = await db.select().from(configuracoes).where(eq(configuracoes.id, 1)).limit(1)
    if (rows.length) conf = rows[0]
  } catch { /* segue sem config */ }

  // Corpo em texto puro — preserva quebras de linha como HTML
  const corpoHtml = opts.corpo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

  // Separa imagens de outros anexos
  const imagens = opts.anexos.filter(a => a.tipo.startsWith('image/'))
  const outrosAnexos = opts.anexos.filter(a => !a.tipo.startsWith('image/'))
  const iconUrl = (name: string) => `${opts.baseUrl}/icons/${name}.png`

  // Imagens como inline attachments referenciadas por cid
  const imagensHtml = imagens.map((a, i) =>
    `<div style="margin:16px 0;"><img src="cid:img${i}" alt="${a.nome}" style="max-width:100%;border-radius:6px;display:block;" /></div>`
  ).join('')

  const htmlCorpo = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:#040505;padding:18px 28px;">
    <span style="color:#39FF14;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;">speceEMAIL</span>
  </td></tr>
  <tr><td style="padding:28px;font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.8;">
    <div style="font-size:13px;color:#888;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #eee;">
      <strong style="color:#555;">De:</strong> ${opts.deNome || opts.deEmail}<br/>
      <strong style="color:#555;">Para:</strong> ${opts.para}
    </div>
    <div style="white-space:pre-wrap;word-break:break-word;font-size:15px;color:#222;line-height:1.8;">${corpoHtml}</div>
    ${imagensHtml}
    <!-- ASSINATURA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;padding-top:18px;border-top:1px solid #e4e4e4;">
      <tr><td style="font-family:Arial,sans-serif;">
        <div style="font-size:15px;color:#333;font-weight:bold;margin-bottom:14px;">${conf.nomeEmpresa || opts.deNome || 'speceEMAIL'}</div>
        <table cellpadding="0" cellspacing="0"><tr>
          ${conf.site ? `<td style="padding:0 8px 6px 0;"><a href="${conf.site}" target="_blank" style="text-decoration:none;"><img src="${iconUrl('site')}" alt="Site" width="32" height="32" style="width:32px;height:32px;border:0;display:block;"/></a></td>` : ''}
          ${(() => {
            const wa = (conf.whatsapp || '').replace(/\D/g,'')
            const waFull = wa.startsWith('55') ? wa : '55' + wa
            return wa ? `<td style="padding:0 8px 6px;"><a href="https://wa.me/${waFull}" target="_blank" style="text-decoration:none;"><img src="${iconUrl('wa')}" alt="WhatsApp" width="32" height="32" style="width:32px;height:32px;border:0;display:block;"/></a></td>` : ''
          })()}
          ${conf.instagram ? `<td style="padding:0 8px 6px;"><a href="https://instagram.com/${conf.instagram.replace(/^@/,'')}" target="_blank" style="text-decoration:none;"><img src="${iconUrl('ig')}" alt="Instagram" width="32" height="32" style="width:32px;height:32px;border:0;display:block;"/></a></td>` : ''}
          ${conf.facebook ? `<td style="padding:0 0 6px;"><a href="https://facebook.com/${conf.facebook.replace(/^@/,'')}" target="_blank" style="text-decoration:none;"><img src="${iconUrl('fb')}" alt="Facebook" width="32" height="32" style="width:32px;height:32px;border:0;display:block;"/></a></td>` : ''}
        </tr></table>
        <div style="margin-top:6px;font-size:12px;color:#999;line-height:1.6;">
          Enviado por <strong>${opts.deNome || opts.deEmail}</strong> via <span style="color:#2ecc40;font-weight:bold;">speceEMAIL</span>
          ${conf.emailContato ? `<br/>Contato: ${conf.emailContato}` : ''}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`

  const payload: Record<string, unknown> = {
    sender: { name: opts.deNome || 'speceEMAIL', email: 'santossilvac992@gmail.com' },
    replyTo: {
      name: opts.deNome || opts.deEmail,
      email: process.env.EMAIL_INBOUND_ADDRESS || opts.deEmail,
    },
    to: [{ email: opts.para }],
    subject: opts.assunto || '(Sem assunto)',
    htmlContent: htmlCorpo,
    textContent: opts.corpo || ' ',
  }

  // Imagens como inline (cid) para aparecerem dentro do e-mail
  const allAttachments: Array<{ name: string; content: string; contentId?: string }> = []

  imagens.forEach((a, i) => {
    allAttachments.push({
      name: a.nome,
      content: a.base64,
      contentId: `img${i}`,
    })
  })

  // Outros arquivos como anexo normal
  outrosAnexos.forEach(a => {
    allAttachments.push({ name: a.nome, content: a.base64 })
  })

  if (allAttachments.length > 0) {
    payload.attachment = allAttachments
  }

  log(`[POST] ANEXOS_ENVIADOS= ${JSON.stringify(allAttachments.map(a => ({ nome: a.name, cid: a.contentId || null, tam: a.content.length })))}`)

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `Brevo error ${res.status}`)
  }

  return true
}

export async function GET(request: Request) {
  try {
    const usuario = await getUsuario()
    if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const pasta = searchParams.get('pasta') || 'entrada'

    let rows
    if (pasta === 'entrada') {
      rows = await db.select().from(mensagens)
        .where(and(eq(mensagens.paraEmail, usuario.email), eq(mensagens.pasta, 'entrada')))
        .orderBy(desc(mensagens.criadoEm))
    } else if (pasta === 'enviados') {
      rows = await db.select().from(mensagens)
        .where(and(eq(mensagens.deEmailId, usuario.id), eq(mensagens.pasta, 'enviados')))
        .orderBy(desc(mensagens.criadoEm))
    } else if (pasta === 'lixeira') {
      rows = await db.select().from(mensagens)
        .where(and(
          eq(mensagens.pasta, 'lixeira'),
          or(eq(mensagens.paraEmail, usuario.email), eq(mensagens.deEmailId, usuario.id)),
        ))
        .orderBy(desc(mensagens.criadoEm))
    } else {
      rows = await db.select().from(mensagens)
        .where(and(eq(mensagens.deEmailId, usuario.id), eq(mensagens.pasta, pasta)))
        .orderBy(desc(mensagens.criadoEm))
    }

    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const LOG = process.env.LOG_FILE || '/tmp/spece.log'
  const log = (msg: string) => {
    try { require('fs').appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`) } catch {}
  }
  try {
    const usuario = await getUsuario()
    if (!usuario) {
      log('[POST] NAO_AUTENTICADO (cookie não reconhecido)')
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const { para, assunto, corpo, isRascunho, anexos } = body
    log(`[POST] AUTENTICADO ${usuario.email} -> ${para} corpo_len=${corpo?.length ?? 0}`)

    if (!isRascunho && !para) return NextResponse.json({ erro: 'Informe o destinatário.' }, { status: 400 })

    const anexosParsed: Array<{ nome: string; tipo: string; tamanho: number; base64: string }> = anexos ?? []
    const totalAnexos = anexosParsed.reduce((total, anexo) => total + Number(anexo.tamanho || 0), 0)

    if (!Array.isArray(anexos) || anexosParsed.some(anexo =>
      !anexo?.nome || !anexo?.tipo || !anexo?.base64 || !TIPOS_ANEXO_PERMITIDOS.has(anexo.tipo)
    )) {
      return NextResponse.json({ erro: 'Anexo inválido. Envie imagens, PDF ou vídeo MP4/WebM/MOV.' }, { status: 400 })
    }

    if (totalAnexos > MAX_ANEXOS_BYTES) {
      return NextResponse.json({ erro: 'Os anexos juntos devem ter no máximo 10 MB.' }, { status: 413 })
    }

    const anexosJson = JSON.stringify(anexosParsed)

    if (isRascunho) {
      const inserted = await db.insert(mensagens).values({
        deEmailId: usuario.id,
        deEmail: usuario.email,
        deNome: usuario.nome,
        paraEmail: para || '',
        assunto: assunto || '(Rascunho)',
        corpo: corpo || '',
        anexos: anexosJson,
        pasta: 'rascunho',
        lida: true,
      }).returning()
      return NextResponse.json({ mensagem: 'Rascunho salvo!', dados: inserted[0] })
    }

    const paraEmail = para.toLowerCase().trim()
    const assuntoFinal = assunto || '(Sem assunto)'
    const corpoFinal = corpo || ''

    // Verifica se é usuário interno
    const destinatarioInterno = await db.select().from(emails)
      .where(eq(emails.email, paraEmail)).limit(1)

    if (destinatarioInterno.length > 0) {
      await db.insert(mensagens).values({
        deEmailId: usuario.id,
        deEmail: usuario.email,
        deNome: usuario.nome,
        paraEmail: paraEmail,
        assunto: assuntoFinal,
        corpo: corpoFinal,
        anexos: anexosJson,
        pasta: 'enviados',
        lida: true,
      })
      await db.insert(mensagens).values({
        deEmailId: usuario.id,
        deEmail: usuario.email,
        deNome: usuario.nome,
        paraEmail: paraEmail,
        assunto: assuntoFinal,
        corpo: corpoFinal,
        anexos: anexosJson,
        pasta: 'entrada',
        lida: false,
      })
      console.log(`[MENSAGENS POST] Entrega interna OK`)
      return NextResponse.json({ mensagem: 'E-mail enviado!' })
    }

    // Envia via Brevo para externo
    log(`[POST] CHAMANDO BREVO para ${paraEmail}`)
    await enviarViaBrevo({
      deNome: usuario.nome,
      deEmail: usuario.email,
      para: paraEmail,
      assunto: assuntoFinal,
      corpo: corpoFinal,
      anexos: anexosParsed,
      baseUrl: new URL(request.url).origin,
    })
    log(`[POST] BREVO OK para ${paraEmail}`)

    await db.insert(mensagens).values({
      deEmailId: usuario.id,
      deEmail: usuario.email,
      deNome: usuario.nome,
      paraEmail: paraEmail,
      assunto: assuntoFinal,
      corpo: corpoFinal,
      anexos: anexosJson,
      pasta: 'enviados',
      lida: true,
    })

    return NextResponse.json({ mensagem: 'E-mail enviado com sucesso!' })
  } catch (err) {
    const erro = String(err)
    log(`[POST] ERRO: ${erro}`)
    console.error('[MENSAGENS POST] ERRO:', err)
    if (erro.includes('unrecognised IP address')) {
      return NextResponse.json({
        erro: 'A Brevo bloqueou o IP deste computador. Autorize o IP público nas configurações de segurança da Brevo.',
      }, { status: 403 })
    }
    if (erro.includes('Key not found') || erro.includes('unauthorised') || erro.includes('Unauthorized')) {
      return NextResponse.json({ erro: 'A chave da Brevo foi rejeitada. Gere uma nova chave API normal.' }, { status: 502 })
    }
    return NextResponse.json({ erro: 'Não foi possível enviar o e-mail. Verifique a configuração da Brevo.' }, { status: 502 })
  }
}
