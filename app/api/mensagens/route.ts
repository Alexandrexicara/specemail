import { NextResponse } from 'next/server'
import { db } from '@/db'
import { mensagens, sessoes, emails, configuracoes } from '@/db/schemas/specemail'
import { eq, and, gt, desc } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Ícones de redes sociais embutidos (base64 PNG) para aparecerem em qualquer cliente de e-mail
const ICON_DIR = join(process.cwd(), 'assets', 'icons')
const iconB64 = (file: string) => readFileSync(join(ICON_DIR, file)).toString('base64')
const ICON_SITE = iconB64('site.png')
const ICON_WA = iconB64('wa.png')
const ICON_IG = iconB64('ig.png')
const ICON_FB = iconB64('fb.png')

export const runtime = 'nodejs'

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
}) {
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
          ${conf.site ? `<td style="padding:0 8px 6px 0;"><a href="${conf.site}" target="_blank" style="text-decoration:none;"><img src="cid:icon-site" alt="Site" width="32" height="32" style="width:32px;height:32px;border:0;"/></a></td>` : ''}
          ${(() => {
            const wa = (conf.whatsapp || '').replace(/\D/g,'')
            const waFull = wa.startsWith('55') ? wa : '55' + wa
            return wa ? `<td style="padding:0 8px 6px;"><a href="https://wa.me/${waFull}" target="_blank" style="text-decoration:none;"><img src="cid:icon-wa" alt="WhatsApp" width="32" height="32" style="width:32px;height:32px;border:0;"/></a></td>` : ''
          })()}
          ${conf.instagram ? `<td style="padding:0 8px 6px;"><a href="https://instagram.com/${conf.instagram.replace(/^@/,'')}" target="_blank" style="text-decoration:none;"><img src="cid:icon-ig" alt="Instagram" width="32" height="32" style="width:32px;height:32px;border:0;"/></a></td>` : ''}
          ${conf.facebook ? `<td style="padding:0 0 6px;"><a href="https://facebook.com/${conf.facebook.replace(/^@/,'')}" target="_blank" style="text-decoration:none;"><img src="cid:icon-fb" alt="Facebook" width="32" height="32" style="width:32px;height:32px;border:0;"/></a></td>` : ''}
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
    replyTo: { name: opts.deNome || opts.deEmail, email: 'santossilvac992@gmail.com' },
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

  // Ícones de redes sociais sempre embutidos (cid) para o Gmail não bloquear
  if (conf.site) allAttachments.push({ name: 'site.png', content: ICON_SITE, contentId: 'icon-site' })
  if ((conf.whatsapp || '').replace(/\D/g, '')) allAttachments.push({ name: 'wa.png', content: ICON_WA, contentId: 'icon-wa' })
  if (conf.instagram) allAttachments.push({ name: 'ig.png', content: ICON_IG, contentId: 'icon-ig' })
  if (conf.facebook) allAttachments.push({ name: 'fb.png', content: ICON_FB, contentId: 'icon-fb' })

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

    // Salva nos enviados
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
    console.log(`[MENSAGENS POST] Salvo em enviados OK`)

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
    })
    log(`[POST] BREVO OK para ${paraEmail}`)

    return NextResponse.json({ mensagem: 'E-mail enviado com sucesso!' })
  } catch (err) {
    log(`[POST] ERRO: ${String(err)}`)
    console.error('[MENSAGENS POST] ERRO:', err)
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}
