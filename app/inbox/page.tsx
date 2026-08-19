'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { IconeGlobo, IconeWhatsApp, IconeInstagram, IconeFacebook } from '@/components/SocialIcons'

interface Config {
  nomeEmpresa: string; site: string; whatsapp: string
  instagram: string; facebook: string; emailContato: string
}
interface Usuario { id: number; nome: string; email: string; cargo: string }
interface Anexo { nome: string; tipo: string; tamanho: number; base64: string }
interface Mensagem {
  id: number; deEmail: string; deNome: string; paraEmail: string
  assunto: string; corpo: string; lida: boolean; pasta: string
  criadoEm: string; anexos?: string
}
type Pasta = 'entrada' | 'enviados' | 'rascunho' | 'lixeira'

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}
function parsedAnexos(raw?: string): Anexo[] {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

// Limite por arquivo: 14MB — o provedor de e-mail (Brevo) barra e-mails acima
// de 20MB no total (erro "Mail size too large"). Em base64 isso equivale a ~14MB
// de arquivo. Acima disso o Brevo recusa o envio.
const MAX_POR_ARQUIVO = 14 * 1024 * 1024
const MAX_TOTAL_ANEXOS = 14 * 1024 * 1024

const PASTAS: { key: Pasta; icon: string; label: string }[] = [
  { key: 'entrada', icon: '📥', label: 'Entrada' },
  { key: 'enviados', icon: '📤', label: 'Enviados' },
  { key: 'rascunho', icon: '📝', label: 'Rascunhos' },
  { key: 'lixeira', icon: '🗑️', label: 'Lixeira' },
]

export default function InboxPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [pasta, setPasta] = useState<Pasta>('entrada')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [aberta, setAberta] = useState<Mensagem | null>(null)
  const [compondo, setCompondo] = useState(false)
  const [compose, setCompose] = useState({ para: '', assunto: '', corpo: '' })
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [enviando, setEnviando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const [cfg, setCfg] = useState<Config>({ nomeEmpresa: 'speceEMAIL', site: '', whatsapp: '', instagram: '', facebook: '', emailContato: '' })
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [painelM, setPainelM] = useState<'lista' | 'detalhe'>('lista')
  // Modal de re-login quando sessão expira
  const [sessaoExpirada, setSessaoExpirada] = useState(false)
  const [reLoginSenha, setReLoginSenha] = useState('')
  const [reLoginando, setReLoginando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, tipo: 'ok' | 'erro' = 'ok') => {
    setToast({ msg, tipo })
    // Erros ficam 6 segundos, sucesso 3 segundos
    setTimeout(() => setToast(null), tipo === 'erro' ? 6000 : 3000)
  }

  const carregarMensagens = useCallback(async (p: Pasta) => {
    try {
      const res = await fetch(`/api/mensagens?pasta=${p}`, { credentials: 'include' })
      if (res.status === 401) {
        setSessaoExpirada(true)
        return
      }
      const data = await res.json()
      if (Array.isArray(data)) setMensagens(data)
    } catch { /* silent */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario) return
    setReLoginando(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: usuario.email, senha: reLoginSenha }),
      })
      if (res.ok) {
        setSessaoExpirada(false)
        setReLoginSenha('')
        showToast('Sessão renovada! Pode continuar.')
        carregarMensagens(pasta)
      } else {
        showToast('Senha incorreta.', 'erro')
      }
    } catch { showToast('Erro de conexão.', 'erro') }
    finally { setReLoginando(false) }
  }

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(d => {
      if (!d.usuario) { router.push('/login'); return }
      setUsuario(d.usuario)
      setCarregando(false)
    })
    fetch('/api/configuracoes', { credentials: 'include' }).then(r => r.json()).then(d => { if (d?.nomeEmpresa) setCfg(d) }).catch(() => {})
  }, [router])

  useEffect(() => { if (usuario) carregarMensagens(pasta) }, [usuario, pasta, carregarMensagens])

  // Polling automático: atualiza a caixa de entrada a cada 30 segundos
  useEffect(() => {
    if (!usuario) return
    const interval = setInterval(() => {
      carregarMensagens(pasta)
    }, 30000)
    return () => clearInterval(interval)
  }, [usuario, pasta, carregarMensagens])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  const abrirMensagem = async (msg: Mensagem) => {
    setAberta(msg)
    setCompondo(false)
    setPainelM('detalhe')
    setSidebarAberta(false)
    if (!msg.lida && msg.pasta === 'entrada') {
      await fetch(`/api/mensagens/${msg.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lida: true }) })
      setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, lida: true } : m))
    }
  }

  const excluirMensagem = async (id: number) => {
    await fetch(`/api/mensagens/${id}`, { method: 'DELETE', credentials: 'include' })
    setMensagens(prev => prev.filter(m => m.id !== id))
    if (aberta?.id === id) { setAberta(null); setPainelM('lista') }
  }

  const abrirCompose = (para = '', assunto = '') => {
    setCompose({ para, assunto, corpo: '' })
    setAnexos([])
    setCompondo(true)
    setAberta(null)
    setPainelM('detalhe')
    setSidebarAberta(false)
  }

  const handleArquivos = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.size > MAX_POR_ARQUIVO) { showToast(`"${file.name}" excede 14 MB por arquivo.`, 'erro'); return }
      const reader = new FileReader()
      reader.onload = e => {
        const base64 = (e.target?.result as string).split(',')[1]
        setAnexos(prev => [...prev, { nome: file.name, tipo: file.type, tamanho: file.size, base64 }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removerAnexo = (i: number) => setAnexos(prev => prev.filter((_, idx) => idx !== i))

  const enviarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const logCliente = (etapa: string, extra = '') => {
      try { fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa, extra }) }) } catch {}
    }
    logCliente('inicio', `para=${compose.para} corpo_len=${compose.corpo.length}`)
    if (!compose.para.trim()) { showToast('Informe o destinatário.', 'erro'); logCliente('erro_destinatario'); return }
    if (!compose.para.includes('@') || !compose.para.includes('.')) { showToast('E-mail inválido. Use: nome@dominio.com', 'erro'); logCliente('erro_email_invalido'); return }
    if (!compose.corpo.trim() && anexos.length === 0) { showToast('Escreva uma mensagem ou adicione um anexo.', 'erro'); logCliente('erro_corpo_vazio'); return }

    const totalAnexos = anexos.reduce((s, a) => s + a.tamanho, 0)
    if (totalAnexos > MAX_TOTAL_ANEXOS) {
      showToast(`Anexos muito grandes (${formatBytes(totalAnexos)}). Limite: 14 MB por e-mail.`, 'erro')
      return
    }

    setEnviando(true)
    logCliente('set_enviando')
    const timeoutId = setTimeout(() => {
      setEnviando(false)
      showToast('Demorou para confirmar. Tente novamente.', 'erro')
      logCliente('timeout_90s')
    }, 90000)

    try {
      const controller = new AbortController()
      const fetchTimeout = setTimeout(() => controller.abort(), 85000)
      logCliente('antes_fetch')

      const res = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          para: compose.para.trim().toLowerCase(),
          assunto: compose.assunto,
          corpo: compose.corpo,
          anexos,
        }),
      })
      clearTimeout(fetchTimeout)

      let data: { mensagem?: string; erro?: string } = {}
      try { data = await res.json() } catch { data = {} }
      logCliente('resposta', `status=${res.status} body=${JSON.stringify(data)}`)

      if (res.status === 401) {
        setSessaoExpirada(true)
      } else if (res.ok) {
        showToast('✓ E-mail enviado com sucesso!')
        setCompose({ para: '', assunto: '', corpo: '' })
        setAnexos([])
        setCompondo(false)
        setPasta('enviados')
        setPainelM('lista')
        setAberta(null)
        carregarMensagens('enviados')
      } else {
        const msgErro = data.erro || 'Erro ao enviar. Tente novamente.'
        showToast(msgErro.length > 80 ? 'Erro ao enviar. Tente novamente.' : msgErro, 'erro')
      }
    } catch (err: unknown) {
      logCliente('excecao', err instanceof Error ? err.message : String(err))
      showToast('Falha ao enviar. Tente novamente.', 'erro')
    } finally {
      clearTimeout(timeoutId)
      setEnviando(false)
    }
  }

  const naoLidas = mensagens.filter(m => !m.lida && m.pasta === 'entrada').length

  const limparPasta = async () => {
    if (mensagens.length === 0) { showToast('A pasta já está vazia.', 'erro'); return }
    const pastaLabel = PASTAS.find(p => p.key === pasta)?.label || pasta
    if (!confirm(`Limpar toda a pasta "${pastaLabel}"? Esta ação não pode ser desfeita.`)) return
    try {
      const res = await fetch(`/api/mensagens/limpar?pasta=${pasta}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        setMensagens([])
        setAberta(null)
        setPainelM('lista')
        showToast(`✓ Pasta "${pastaLabel}" limpa!`)
      } else {
        showToast(data.erro || 'Erro ao limpar.', 'erro')
      }
    } catch { showToast('Erro de conexão.', 'erro') }
  }

  const socialLinks = [
    { href: cfg.site || '#', icone: <IconeGlobo size={19} />, label: 'Site', cor: '#39FF14' },
    { href: cfg.whatsapp ? `https://wa.me/55${cfg.whatsapp.replace(/\D/g, '')}` : '#', icone: <IconeWhatsApp size={19} />, label: 'WhatsApp', cor: '#25d366' },
    { href: cfg.instagram ? `https://instagram.com/${cfg.instagram.replace('@', '')}` : '#', icone: <IconeInstagram size={19} />, label: 'Instagram', cor: '#E1306C' },
    { href: cfg.facebook ? `https://facebook.com/${cfg.facebook}` : '#', icone: <IconeFacebook size={19} />, label: 'Facebook', cor: '#1877F2' },
  ]

  if (carregando) return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
        <p style={{ color: 'var(--acid-green)', fontFamily: 'var(--font-mono)' }}>Carregando...</p>
      </div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: '#0A0C0B', border: '2px solid rgba(57,255,20,0.2)',
    borderRadius: 10, fontSize: 15, color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 5, color: 'var(--text-secondary)', fontSize: 12,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>

      {/* MODAL RE-LOGIN: sessão expirada */}
      {sessaoExpirada && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#0D110F', border: '2px solid rgba(57,255,20,0.4)', borderRadius: 16, padding: 32, maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--acid-green)', marginBottom: 8 }}>🔒 Sessão expirada</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Digite sua senha para continuar sem perder o que estava fazendo.
            </div>
            <form onSubmit={reLogin}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Seu e-mail</div>
              <div style={{ padding: '10px 14px', background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 8, color: 'var(--acid-green)', fontSize: 14, marginBottom: 14, fontFamily: 'monospace' }}>
                {usuario?.email}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Senha</div>
              <input
                type="password" autoFocus required
                value={reLoginSenha}
                onChange={e => setReLoginSenha(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '12px 14px', background: '#0A0C0B', border: '2px solid rgba(57,255,20,0.3)', borderRadius: 8, fontSize: 15, color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
              />
              <button type="submit" disabled={reLoginando} style={{ width: '100%', padding: '12px', background: 'var(--acid-green)', color: '#000', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {reLoginando ? 'Entrando...' : 'Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.tipo === 'ok' ? 'rgba(57,255,20,0.15)' : 'rgba(255,60,60,0.15)',
          border: `1px solid ${toast.tipo === 'ok' ? 'rgba(57,255,20,0.6)' : 'rgba(255,60,60,0.6)'}`,
          borderRadius: 9999, padding: '10px 22px',
          color: toast.tipo === 'ok' ? 'var(--acid-green)' : '#ff6060',
          fontWeight: 600, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* HEADER */}
      <header style={{
        background: 'var(--surface)', borderBottom: '2px solid var(--acid-green)',
        boxShadow: 'var(--glow-sm)', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Hamburguer só no mobile */}
          <button onClick={() => setSidebarAberta(v => !v)}
            style={{
              width: 34, height: 34, borderRadius: 9999, border: '1px solid rgba(57,255,20,0.4)',
              background: sidebarAberta ? 'var(--acid-green)' : 'rgba(57,255,20,0.1)',
              color: sidebarAberta ? '#040505' : 'var(--acid-green)',
              cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            className="menu-btn"
          >{sidebarAberta ? '✕' : '☰'}</button>
          <span style={{ fontSize: 18 }}>📧</span>
          <span style={{ color: 'var(--acid-green)', fontWeight: 700, fontSize: 18, textShadow: 'var(--glow-sm)' }}>speceEMAIL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 9999, padding: '4px 12px' }}>
            <a href={`mailto:${usuario?.email}`} style={{ color: 'var(--acid-green)', fontSize: 12, fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
              {usuario?.email}
            </a>
          </div>
          <button onClick={logout} style={{
            padding: '6px 12px', borderRadius: 9999, background: 'transparent',
            color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer', fontSize: 12, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6060'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#ff6060' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
          >Sair</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* OVERLAY mobile quando sidebar está aberta */}
        {sidebarAberta && (
          <div onClick={() => setSidebarAberta(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.55)' }}
            className="sidebar-overlay" />
        )}

        {/* SIDEBAR */}
        <aside style={{
          width: 220, background: 'var(--surface)', borderRight: '1px solid rgba(57,255,20,0.12)',
          padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
          transition: 'transform 0.22s ease',
        }} className={sidebarAberta ? 'sidebar sidebar-open' : 'sidebar sidebar-closed'}>

          <button onClick={() => abrirCompose()} style={{
            width: '100%', padding: '11px 16px', borderRadius: 9999,
            background: 'var(--acid-green)', color: '#040505', border: 'none',
            fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 0 20px rgba(57,255,20,0.4)', marginBottom: 14,
          }}>✏️ Novo E-mail</button>

          {PASTAS.map(p => (
            <button key={p.key}
              onClick={() => { setPasta(p.key); setAberta(null); setCompondo(false); setSidebarAberta(false); setPainelM('lista') }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 10, whiteSpace: 'nowrap',
                background: pasta === p.key ? 'rgba(57,255,20,0.1)' : 'transparent',
                border: pasta === p.key ? '1px solid rgba(57,255,20,0.4)' : '1px solid transparent',
                color: pasta === p.key ? 'var(--acid-green)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 14, textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s',
              }}>
              <span>{p.icon} {p.label}</span>
              {p.key === 'entrada' && naoLidas > 0 && (
                <span style={{ background: 'var(--acid-green)', color: '#040505', borderRadius: 9999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{naoLidas}</span>
              )}
            </button>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(57,255,20,0.1)' }}>
            <div style={{ color: 'var(--text-quiet)', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'center', marginBottom: 10, whiteSpace: 'nowrap' }}>
              <div style={{ marginBottom: 3 }}>💾 10 GB disponível</div>
              <div style={{ color: 'var(--acid-green)' }}>Plano Ativo</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {socialLinks.map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" title={l.label}
                  style={{ color: 'rgba(57,255,20,0.5)', display: 'flex', transition: 'color 0.15s, transform 0.15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.color = l.cor; el.style.transform = 'scale(1.2)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.color = 'rgba(57,255,20,0.5)'; el.style.transform = 'scale(1)' }}
                >{l.icone}</a>
              ))}
            </div>
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL */}
        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }} className="main-content">

          {/* LISTA DE MENSAGENS — oculta no mobile quando detalhe está aberto */}
          <div style={{ borderRight: '1px solid rgba(57,255,20,0.12)', overflowY: 'auto', flexShrink: 0 }}
            className={(compondo || aberta) ? 'lista-msgs lista-msgs-narrow' : 'lista-msgs lista-msgs-full'}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(57,255,20,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 15, margin: 0 }}>
                {PASTAS.find(p => p.key === pasta)?.icon} {PASTAS.find(p => p.key === pasta)?.label}
                {mensagens.length > 0 && (
                  <span style={{ marginLeft: 7, fontSize: 12, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
                    ({mensagens.length})
                  </span>
                )}
              </h3>
              {mensagens.length > 0 && (
                <button onClick={limparPasta} title={`Limpar pasta ${PASTAS.find(p => p.key === pasta)?.label}`}
                  style={{
                    padding: '5px 11px', borderRadius: 9999, background: 'rgba(255,100,60,0.08)',
                    color: '#ff7a50', border: '1px solid rgba(255,100,60,0.35)',
                    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,100,60,0.18)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,100,60,0.08)' }}
                >🧹 Limpar</button>
              )}
            </div>
            {mensagens.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                📭 Nenhuma mensagem aqui.
              </div>
            ) : mensagens.map(msg => (
              <div key={msg.id} onClick={() => abrirMensagem(msg)}
                style={{
                  padding: '13px 14px', borderBottom: '1px solid rgba(57,255,20,0.07)', cursor: 'pointer',
                  background: aberta?.id === msg.id ? 'rgba(57,255,20,0.08)' : (!msg.lida ? 'rgba(57,255,20,0.04)' : 'transparent'),
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (aberta?.id !== msg.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(57,255,20,0.06)' }}
                onMouseLeave={e => { if (aberta?.id !== msg.id) (e.currentTarget as HTMLDivElement).style.background = !msg.lida ? 'rgba(57,255,20,0.04)' : 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: msg.lida ? 400 : 700, color: msg.lida ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                    {!msg.lida && <span style={{ color: 'var(--acid-green)', marginRight: 4 }}>●</span>}
                    {pasta === 'enviados' ? msg.paraEmail : (msg.deNome || msg.deEmail)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 6 }}>
                    {new Date(msg.criadoEm).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: msg.lida ? 400 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.assunto}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {parsedAnexos(msg.anexos).length > 0 && <span style={{ color: 'var(--orange)', marginRight: 6 }}>📎</span>}
                  {msg.corpo.substring(0, 70)}
                </div>
              </div>
            ))}
          </div>

          {/* PAINEL DE LEITURA */}
          {aberta && !compondo && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', minWidth: 0 }}
              className={painelM === 'detalhe' ? 'detalhe-panel detalhe-visible' : 'detalhe-panel detalhe-hidden'}>
              {/* Botão voltar mobile */}
              <button onClick={() => setPainelM('lista')}
                style={{ display: 'none', marginBottom: 14, padding: '7px 14px', borderRadius: 9999, background: 'transparent', color: 'var(--acid-green)', border: '1px solid rgba(57,255,20,0.4)', cursor: 'pointer', fontSize: 13 }}
                className="btn-voltar-mobile">
                ‹ Voltar
              </button>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>{aberta.assunto}</h2>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => abrirCompose(aberta.deEmail, `Re: ${aberta.assunto}`)}
                    style={{ padding: '7px 14px', borderRadius: 9999, background: 'rgba(57,255,20,0.1)', color: 'var(--acid-green)', border: '1px solid rgba(57,255,20,0.4)', cursor: 'pointer', fontSize: 13 }}>
                    ↩ Responder
                  </button>
                  <button onClick={() => excluirMensagem(aberta.id)}
                    style={{ padding: '7px 12px', borderRadius: 9999, background: 'rgba(255,50,50,0.1)', color: '#ff6060', border: '1px solid rgba(255,50,50,0.3)', cursor: 'pointer', fontSize: 13 }}>
                    🗑️
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--card)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: 'var(--text-quiet)', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 3 }}>De</div>
                    <div style={{ fontSize: 14 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{aberta.deNome}</strong>{' '}
                      <a href={`mailto:${aberta.deEmail}`} style={{ color: 'var(--acid-green)', fontSize: 13, textDecoration: 'none' }}>&lt;{aberta.deEmail}&gt;</a>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-quiet)', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 3 }}>Para</div>
                    <a href={`mailto:${aberta.paraEmail}`} style={{ color: 'var(--acid-green)', fontSize: 14, textDecoration: 'none' }}>{aberta.paraEmail}</a>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-quiet)', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 3 }}>Data</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{new Date(aberta.criadoEm).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              </div>

              <div style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {aberta.corpo}
              </div>

              {/* Assinatura social */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(57,255,20,0.2)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>— {cfg.nomeEmpresa}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {socialLinks.map(l => (
                    <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'rgba(57,255,20,0.5)', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12, transition: 'color 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = l.cor }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(57,255,20,0.5)' }}
                    >{l.icone}<span style={{ fontFamily: 'var(--font-mono)' }}>{l.label}</span></a>
                  ))}
                </div>
              </div>

              {/* Anexos */}
              {parsedAnexos(aberta.anexos).length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ color: 'var(--text-quiet)', fontSize: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 10 }}>
                    📎 Anexos ({parsedAnexos(aberta.anexos).length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {parsedAnexos(aberta.anexos).map((a, i) => {
                      const isImg = a.tipo.startsWith('image/')
                      const url = `data:${a.tipo};base64,${a.base64}`
                      return (
                        <div key={i} style={{ background: 'var(--card)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 10, overflow: 'hidden', width: isImg ? 140 : 'auto', maxWidth: 200 }}>
                          {isImg && <img src={url} alt={a.nome} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />}
                          <div style={{ padding: '8px 10px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{formatBytes(a.tamanho)}</div>
                            <a href={url} download={a.nome} style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--acid-green)', textDecoration: 'none' }}>⬇ Baixar</a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COMPOR */}
          {compondo && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', minWidth: 0 }}
              className={painelM === 'detalhe' ? 'detalhe-panel detalhe-visible' : 'detalhe-panel detalhe-hidden'}>
              {/* Botão voltar mobile */}
              <button onClick={() => { setCompondo(false); setPainelM('lista') }}
                style={{ display: 'none', marginBottom: 14, padding: '7px 14px', borderRadius: 9999, background: 'transparent', color: 'var(--acid-green)', border: '1px solid rgba(57,255,20,0.4)', cursor: 'pointer', fontSize: 13 }}
                className="btn-voltar-mobile">
                ‹ Voltar
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 style={{ color: 'var(--orange)', fontSize: 19, fontWeight: 700 }}>✏️ Novo E-mail</h2>
                <button onClick={() => { setCompondo(false); setPainelM('lista') }}
                  style={{ padding: '6px 14px', borderRadius: 9999, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 13 }}
                  className="btn-fechar-desktop">✕ Fechar</button>
              </div>

              <form onSubmit={enviarEmail}>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Para <span style={{ color: 'var(--acid-green)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="destinatario@dominio.com"
                      value={compose.para}
                      onChange={e => setCompose(p => ({ ...p, para: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: compose.para ? 42 : 14, color: 'var(--acid-green)' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--acid-green)'; e.target.style.boxShadow = 'var(--glow-sm)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(57,255,20,0.2)'; e.target.style.boxShadow = 'none' }}
                    />
                    {compose.para && (
                      <a href={`mailto:${compose.para}`} tabIndex={-1}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--acid-green)', fontSize: 16, textDecoration: 'none' }}
                        title="Abrir cliente de e-mail">🔗</a>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Assunto</label>
                  <input type="text" placeholder="Assunto do e-mail"
                    value={compose.assunto}
                    onChange={e => setCompose(p => ({ ...p, assunto: e.target.value }))}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'var(--acid-green)'; e.target.style.boxShadow = 'var(--glow-sm)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(57,255,20,0.2)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Mensagem</label>
                  <textarea placeholder="Escreva sua mensagem aqui..." rows={8}
                    value={compose.corpo}
                    onChange={e => setCompose(p => ({ ...p, corpo: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--acid-green)'; e.target.style.boxShadow = 'var(--glow-sm)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(57,255,20,0.2)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Prévia assinatura */}
                <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(57,255,20,0.04)', border: '1px dashed rgba(57,255,20,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>ASSINATURA AUTOMÁTICA</div>
                  <div style={{ fontSize: 12, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>— {cfg.nomeEmpresa}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {socialLinks.map(l => (
                      <span key={l.label} style={{ color: 'rgba(57,255,20,0.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        {l.icone} {l.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Anexos */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={labelStyle}>📎 Anexos {anexos.length > 0 && `(${anexos.length})`}</label>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      style={{ padding: '6px 14px', borderRadius: 9999, background: 'transparent', color: 'var(--orange)', border: '1px solid rgba(255,159,28,0.5)', cursor: 'pointer', fontSize: 12 }}>
                      + Adicionar arquivo
                    </button>
                  </div>
                  <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    style={{ display: 'none' }} onChange={e => handleArquivos(e.target.files)} />
                  <div
                    onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--acid-green)' }}
                    onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(57,255,20,0.15)' }}
                    onDrop={e => { e.preventDefault(); handleArquivos(e.dataTransfer.files); (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(57,255,20,0.15)' }}
                    onClick={() => fileRef.current?.click()}
                    style={{ border: '2px dashed rgba(57,255,20,0.15)', borderRadius: 10, padding: anexos.length ? '10px' : '22px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', background: 'rgba(57,255,20,0.02)' }}
                  >
                    {anexos.length === 0 ? (
                      <div style={{ color: 'var(--text-quiet)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                        Arraste arquivos ou toque para selecionar<br />
                        <span style={{ fontSize: 11 }}>(máx. 14 MB por arquivo / por e-mail)</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} onClick={e => e.stopPropagation()}>
                        {anexos.map((a, i) => (
                          <div key={i} style={{ background: 'var(--card)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 200 }}>
                            <span style={{ fontSize: 16 }}>{a.tipo.startsWith('image/') ? '🖼️' : a.tipo.startsWith('video/') ? '🎬' : a.tipo === 'application/pdf' ? '📄' : '📎'}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)' }}>{formatBytes(a.tamanho)}</div>
                            </div>
                            <button type="button" onClick={() => removerAnexo(i)} style={{ background: 'none', border: 'none', color: '#ff6060', cursor: 'pointer', fontSize: 14 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {socialLinks.map((l, i) => (
                      <span key={i} style={{ color: 'rgba(57,255,20,0.5)', display: 'flex' }}>{l.icone}</span>
                    ))}
                  </div>
                  <button type="submit" disabled={enviando} style={{
                    padding: '12px 32px', borderRadius: 9999,
                    background: enviando ? 'rgba(57,255,20,0.4)' : 'var(--acid-green)',
                    color: '#040505', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 15, boxShadow: '0 0 20px rgba(57,255,20,0.4)',
                  }}>
                    {enviando ? '⏳ Enviando...' : '📤 Enviar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Estado vazio */}
          {!aberta && !compondo && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              className={painelM === 'lista' ? '' : 'hide-mobile'}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📬</div>
                <p style={{ fontSize: 15, marginBottom: 6 }}>Selecione um e-mail para ler</p>
                <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>ou clique em <strong style={{ color: 'var(--acid-green)' }}>✏️ Novo E-mail</strong></p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CSS responsivo */}
      <style>{`
        /* Desktop: sidebar sempre visível, sem hamburguer */
        @media (min-width: 768px) {
          .menu-btn { display: none !important; }
          .sidebar { transform: none !important; position: relative !important; }
          .sidebar-overlay { display: none !important; }
          .lista-msgs { display: block !important; }
          .lista-msgs-narrow { width: 300px; }
          .lista-msgs-full { width: 100%; }
          .detalhe-panel { display: flex !important; flex-direction: column; }
          .btn-voltar-mobile { display: none !important; }
          .btn-fechar-desktop { display: inline-block !important; }
          .hide-mobile { display: flex !important; }
        }

        /* Mobile: sidebar desliza por cima, painéis alternam */
        @media (max-width: 767px) {
          .menu-btn { display: flex !important; }
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            z-index: 50;
            padding-top: 70px !important;
          }
          .sidebar-closed { transform: translateX(-100%) !important; }
          .sidebar-open { transform: translateX(0) !important; }
          .main-content { position: relative; }

          /* Lista de mensagens */
          .lista-msgs { width: 100% !important; border-right: none !important; }
          .lista-msgs-narrow { display: none !important; }
          .lista-msgs-full { display: block !important; }

          /* Painel de detalhe / compose */
          .detalhe-panel {
            position: fixed !important;
            inset: 0 !important;
            z-index: 30;
            background: var(--background);
            overflow-y: auto;
            padding: 16px !important;
            flex-direction: column;
          }
          .detalhe-visible { display: flex !important; }
          .detalhe-hidden { display: none !important; }
          .btn-voltar-mobile { display: block !important; }
          .btn-fechar-desktop { display: none !important; }
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
