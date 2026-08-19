'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconeGlobo, IconeWhatsApp, IconeInstagram, IconeFacebook } from '@/components/SocialIcons'

interface Config {
  nomeEmpresa: string
  site: string
  whatsapp: string
  instagram: string
  facebook: string
  emailContato: string
}

interface EmailRecord {
  id: number
  nome: string
  email: string
  cargo: string
  ativo: boolean
  criadoEm: string
}

type Aba = 'config' | 'emails'

const TICKER_ITEMS = [
  '📧 speceEMAIL', '10 GB / usuário', 'R$ 20,00/mês', 'Anexos até 14 MB',
  'E-mails Ilimitados', 'Suporte Premium', 'Senhas Criptografadas', 'Gestão Total',
]

export default function Home() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('config')
  const [config, setConfig] = useState<Config>({
    nomeEmpresa: '', site: '', whatsapp: '', instagram: '', facebook: '', emailContato: '',
  })
  const [emailsList, setEmailsList] = useState<EmailRecord[]>([])
  const [novoEmail, setNovoEmail] = useState({ nome: '', email: '', senha: '', cargo: '', cpf: '' })
  const [prefixoEmail, setPrefixoEmail] = useState('')
  const DOMINIO = '@specemail.com.br'
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [criando, setCriando] = useState(false)

  const showToast = (msg: string, tipo: 'ok' | 'erro' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  const carregarConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracoes')
      const data = await res.json()
      setConfig({
        nomeEmpresa: data.nomeEmpresa || '',
        site: data.site || '',
        whatsapp: data.whatsapp || '',
        instagram: data.instagram || '',
        facebook: data.facebook || '',
        emailContato: data.emailContato || '',
      })
    } catch { /* silent */ }
  }, [])

  const carregarEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/emails')
      const data = await res.json()
      if (Array.isArray(data)) setEmailsList(data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    carregarConfig()
    carregarEmails()
  }, [carregarConfig, carregarEmails])

  const salvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (res.ok) showToast(data.mensagem || 'Salvo!')
      else showToast(data.erro || 'Erro ao salvar.', 'erro')
    } catch {
      showToast('Erro de conexão.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const criarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prefixoEmail.trim()) { showToast('Digite o nome do e-mail.', 'erro'); return }
    const emailCompleto = prefixoEmail.trim().toLowerCase().replace(/\s+/g, '.') + DOMINIO
    const dadosEnvio = { ...novoEmail, email: emailCompleto }
    setCriando(true)
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosEnvio),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.precisaPagar && data.dados?.id) {
          // Redirecionar para pagamento imediatamente
          router.push(`/pagamento?emailId=${data.dados.id}`)
          return
        }
        showToast(data.mensagem || 'E-mail criado!')
        setNovoEmail({ nome: '', email: '', senha: '', cargo: '', cpf: '' })
        await carregarEmails()
      } else {
        showToast(data.erro || 'Erro ao criar.', 'erro')
      }
    } catch {
      showToast('Erro de conexão.', 'erro')
    } finally {
      setCriando(false)
    }
  }

  const alternarStatus = async (id: number, novoStatus: boolean) => {
    try {
      await fetch(`/api/emails/${id}/ativo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoStatus }),
      })
      await carregarEmails()
    } catch { /* silent */ }
  }

  const excluirEmail = async (id: number) => {
    if (!confirm('Excluir este e-mail permanentemente?')) return
    try {
      await fetch(`/api/emails/${id}`, { method: 'DELETE' })
      await carregarEmails()
    } catch { /* silent */ }
  }

  const whatsappLink = config.whatsapp
    ? `https://wa.me/55${config.whatsapp.replace(/\D/g, '')}`
    : '#'
  const instagramLink = config.instagram
    ? `https://instagram.com/${config.instagram.replace('@', '')}`
    : '#'
  const facebookLink = config.facebook
    ? `https://facebook.com/${config.facebook}`
    : '#'

  const tickerDoubled = [...TICKER_ITEMS, ...TICKER_ITEMS]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: toast.tipo === 'ok' ? 'rgba(57,255,20,0.15)' : 'rgba(255,60,60,0.15)',
          border: `1px solid ${toast.tipo === 'ok' ? 'rgba(57,255,20,0.6)' : 'rgba(255,60,60,0.6)'}`,
          borderRadius: 9999, padding: '12px 24px',
          color: toast.tipo === 'ok' ? 'var(--acid-green)' : '#ff6060',
          fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
          boxShadow: toast.tipo === 'ok' ? 'var(--glow-sm)' : '0 0 12px rgba(255,60,60,0.4)',
        }}>
          {toast.tipo === 'ok' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      {/* HEADER */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--acid-green)',
        boxShadow: 'var(--glow-sm)',
        padding: '18px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(57,255,20,0.12)',
            border: '1px solid rgba(57,255,20,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>📧</div>
          <div>
            <h1 style={{
              color: 'var(--acid-green)',
              textShadow: 'var(--glow-sm)',
              fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
            }}>speceEMAIL</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
              SISTEMA DE E-MAIL EMPRESARIAL
            </p>
          </div>
        </div>

        {/* Live indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(57,255,20,0.1)',
          border: '1px solid rgba(57,255,20,0.35)',
          borderRadius: 9999, padding: '6px 16px',
        }}>
          <span className="pulse-dot" style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--acid-green)',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--acid-green)', letterSpacing: '0.08em' }}>
            SISTEMA ONLINE
          </span>
        </div>

        <Link href="/login" style={{
          padding: '10px 22px', borderRadius: 9999,
          background: 'var(--orange)', color: '#040505',
          textDecoration: 'none', fontWeight: 700, fontSize: 14,
          boxShadow: '0 0 16px rgba(255,159,28,0.4)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}>
          📬 Acessar E-mail
        </Link>
      </header>

      {/* TICKER */}
      <div style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '10px 0',
        overflow: 'hidden',
      }}>
        <div className="ticker-track" style={{ display: 'flex', gap: 0 }}>
          {tickerDoubled.map((item, i) => (
            <span key={i} style={{
              padding: '0 32px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.06em',
              color: i % 3 === 0 ? 'var(--acid-green)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}>
              {item}
              {i < tickerDoubled.length - 1 && (
                <span style={{ color: 'var(--text-quiet)', marginLeft: 32 }}>•</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* PLANO CARD */}
      <div style={{ maxWidth: 860, margin: '32px auto 0', width: '100%', padding: '0 20px' }}>
        <div style={{
          background: 'var(--card)',
          border: '2px solid var(--orange)',
          borderRadius: 16,
          padding: '24px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 20,
          boxShadow: '0 0 20px rgba(255,159,28,0.15)',
        }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>
              PLANO BÁSICO
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: 42, fontWeight: 700,
                color: 'var(--acid-green)',
                textShadow: '0 0 12px rgba(57,255,20,0.5)',
                fontFamily: 'var(--font-mono)',
              }}>R$ 20,00</span>
              <span style={{ color: 'var(--orange)', fontSize: 16, fontWeight: 600 }}>/mês</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { icon: '💾', label: '10 GB', sub: 'por usuário' },
              { icon: '📨', label: 'Ilimitados', sub: 'e-mails' },
              { icon: '📎', label: '14 MB', sub: 'por anexo' },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20 }}>{item.icon}</div>
                <div style={{ color: 'var(--acid-green)', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <div style={{ maxWidth: 860, margin: '28px auto 0', width: '100%', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {([
            { key: 'config', label: '⚙️ Empresa', sub: 'Configurações' },
            { key: 'emails', label: '📧 E-mails', sub: `${emailsList.length} cadastrado${emailsList.length !== 1 ? 's' : ''}` },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setAba(item.key)}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 12,
                border: aba === item.key
                  ? '2px solid var(--acid-green)'
                  : '2px solid rgba(57,255,20,0.2)',
                background: aba === item.key
                  ? 'rgba(57,255,20,0.1)'
                  : 'var(--card)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                boxShadow: aba === item.key ? 'var(--glow-sm)' : 'none',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: aba === item.key ? 'var(--acid-green)' : 'var(--text-primary)' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {item.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 860, margin: '24px auto', width: '100%', padding: '0 20px', flex: 1 }}>

        {/* CONFIG ABA */}
        {aba === 'config' && (
          <div>
            <h2 style={{
              color: 'var(--orange)',
              fontSize: 20, fontWeight: 700, marginBottom: 20,
              paddingBottom: 10,
              borderBottom: '2px solid rgba(57,255,20,0.25)',
              textShadow: '0 0 8px rgba(255,159,28,0.35)',
            }}>
              ⚙️ Configurações da Empresa
            </h2>
            <form onSubmit={salvarConfig} style={{
              background: 'var(--card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: '28px 32px',
              boxShadow: '0 0 20px rgba(57,255,20,0.08)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {[
                  { id: 'nomeEmpresa', label: 'Nome da Empresa', type: 'text', placeholder: 'Minha Empresa', required: true },
                  { id: 'site', label: 'Site', type: 'url', placeholder: 'https://www.seusite.com.br' },
                  { id: 'whatsapp', label: 'WhatsApp', type: 'text', placeholder: '(11) 99999-9999' },
                  { id: 'instagram', label: 'Instagram', type: 'text', placeholder: '@suaempresa' },
                  { id: 'facebook', label: 'Facebook', type: 'text', placeholder: 'suaempresa' },
                  { id: 'emailContato', label: 'E-mail de Contato', type: 'email', placeholder: 'contato@seusite.com.br' },
                ].map((field) => (
                  <div key={field.id}>
                    <label style={{
                      display: 'block', marginBottom: 6,
                      color: 'var(--text-secondary)', fontSize: 12,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      required={field.required}
                      value={config[field.id as keyof Config]}
                      onChange={(e) => setConfig(prev => ({ ...prev, [field.id]: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px',
                        background: '#0A0C0B',
                        border: '2px solid rgba(57,255,20,0.2)',
                        borderRadius: 10, fontSize: 15, color: 'var(--text-primary)',
                        outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--acid-green)'
                        e.target.style.boxShadow = 'var(--glow-sm)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(57,255,20,0.2)'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={salvando} style={{
                  padding: '14px 36px',
                  borderRadius: 9999,
                  background: salvando ? 'rgba(57,255,20,0.4)' : 'var(--acid-green)',
                  color: '#040505', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.02em',
                  boxShadow: '0 0 24px rgba(57,255,20,0.5)',
                  transition: 'all 0.15s ease-out',
                }}>
                  {salvando ? '⏳ Salvando...' : '💾 Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EMAILS ABA */}
        {aba === 'emails' && (
          <div>
            <h2 style={{
              color: 'var(--orange)',
              fontSize: 20, fontWeight: 700, marginBottom: 20,
              paddingBottom: 10,
              borderBottom: '2px solid rgba(57,255,20,0.25)',
              textShadow: '0 0 8px rgba(255,159,28,0.35)',
            }}>
              📨 Criar Novo E-mail
            </h2>
            <form onSubmit={criarEmail} style={{
              background: 'var(--card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: '28px 32px',
              marginBottom: 32,
              boxShadow: '0 0 20px rgba(57,255,20,0.08)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {/* Nome */}
                {[
                  { id: 'nome', label: 'Nome Completo', type: 'text', placeholder: 'João da Silva', required: true },
                  { id: 'senha', label: 'Senha', type: 'password', placeholder: '••••••••', required: true },
                  { id: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00', required: true },
                  { id: 'cargo', label: 'Cargo / Setor', type: 'text', placeholder: 'Vendas, Atendimento...' },
                ].map((field) => (
                  <div key={field.id}>
                    <label style={{
                      display: 'block', marginBottom: 6,
                      color: 'var(--text-secondary)', fontSize: 12,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {field.label}{field.required && <span style={{ color: 'var(--acid-green)' }}> *</span>}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      required={field.required}
                      value={novoEmail[field.id as keyof typeof novoEmail]}
                      onChange={(e) => setNovoEmail(prev => ({ ...prev, [field.id]: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px',
                        background: '#0A0C0B',
                        border: '2px solid rgba(57,255,20,0.2)',
                        borderRadius: 10, fontSize: 15, color: 'var(--text-primary)',
                        outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--acid-green)'; e.target.style.boxShadow = 'var(--glow-sm)' }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(57,255,20,0.2)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                ))}

                {/* Campo e-mail com domínio fixo */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{
                    display: 'block', marginBottom: 6,
                    color: 'var(--text-secondary)', fontSize: 12,
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    E-mail <span style={{ color: 'var(--acid-green)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0A0C0B', border: '2px solid rgba(57,255,20,0.2)', borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    onFocus={() => {}} id="email-wrapper">
                    <input
                      type="text"
                      placeholder="celio.santos"
                      required
                      value={prefixoEmail}
                      onChange={(e) => setPrefixoEmail(e.target.value.replace(/[@\s]/g, '').toLowerCase())}
                      style={{
                        flex: 1, padding: '12px 14px', background: 'transparent',
                        border: 'none', fontSize: 15, color: 'var(--acid-green)',
                        outline: 'none', fontFamily: 'var(--font-sans)',
                      }}
                      onFocus={(e) => { const w = e.target.closest('div') as HTMLDivElement; if(w){w.style.borderColor='var(--acid-green)';w.style.boxShadow='var(--glow-sm)'} }}
                      onBlur={(e) => { const w = e.target.closest('div') as HTMLDivElement; if(w){w.style.borderColor='rgba(57,255,20,0.2)';w.style.boxShadow='none'} }}
                    />
                    <span style={{
                      padding: '12px 14px', background: 'rgba(57,255,20,0.06)',
                      borderLeft: '1px solid rgba(57,255,20,0.2)',
                      color: 'var(--acid-green)', fontSize: 14, fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap', userSelect: 'none',
                    }}>@specemail.com.br</span>
                  </div>
                  {prefixoEmail && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-quiet)', fontFamily: 'var(--font-mono)' }}>
                      ✉️ E-mail completo: <strong style={{ color: 'var(--acid-green)' }}>{prefixoEmail}@specemail.com.br</strong>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={criando} style={{
                  padding: '14px 36px',
                  borderRadius: 9999,
                  background: criando ? 'rgba(57,255,20,0.4)' : 'var(--acid-green)',
                  color: '#040505', border: 'none', cursor: criando ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.02em',
                  boxShadow: '0 0 24px rgba(57,255,20,0.5)',
                  transition: 'all 0.15s ease-out',
                }}>
                  {criando ? '⏳ Criando...' : '✅ Criar E-mail'}
                </button>
              </div>
            </form>

            <h2 style={{
              color: 'var(--orange)', fontSize: 18, fontWeight: 700, marginBottom: 16,
              textShadow: '0 0 8px rgba(255,159,28,0.35)',
            }}>
              📋 E-mails Cadastrados
              <span style={{
                marginLeft: 10, fontSize: 13,
                background: 'rgba(57,255,20,0.12)',
                border: '1px solid rgba(57,255,20,0.35)',
                borderRadius: 9999, padding: '2px 10px',
                color: 'var(--acid-green)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}>{emailsList.length}</span>
            </h2>

            {emailsList.length === 0 ? (
              <div style={{
                background: 'var(--card)',
                border: '1px dashed rgba(57,255,20,0.25)',
                borderRadius: 16, padding: '48px 24px',
                textAlign: 'center', color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              }}>
                📭 Nenhum e-mail cadastrado ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {emailsList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid rgba(57,255,20,0.15)',
                      borderRadius: 12, padding: '18px 24px',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(57,255,20,0.4)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--glow-sm)'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(57,255,20,0.15)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'rgba(57,255,20,0.1)',
                        border: '1px solid rgba(57,255,20,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--acid-green)', fontWeight: 700, fontSize: 16,
                      }}>
                        {item.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: 'var(--acid-green)', fontWeight: 700, fontSize: 15 }}>
                          {item.nome}
                        </div>
                        <div style={{ color: 'var(--text-primary)', fontSize: 14, margin: '2px 0' }}>
                          {item.email}
                        </div>
                        <div style={{
                          color: 'var(--text-secondary)', fontSize: 11,
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                        }}>
                          {item.cargo || 'Sem cargo'} •{' '}
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Status indicator */}
                      {item.ativo && (
                        <span className="pulse-dot" style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#37F0C2', display: 'inline-block', marginRight: 4,
                        }} />
                      )}
                      <button
                        onClick={() => alternarStatus(item.id, !item.ativo)}
                        style={{
                          padding: '8px 18px', borderRadius: 9999,
                          background: item.ativo ? 'rgba(57,255,20,0.15)' : 'rgba(100,100,100,0.2)',
                          color: item.ativo ? 'var(--acid-green)' : 'var(--text-secondary)',
                          border: item.ativo ? '1px solid rgba(57,255,20,0.5)' : '1px solid rgba(100,100,100,0.4)',
                          cursor: 'pointer', fontWeight: 600, fontSize: 13,
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                          transition: 'all 0.15s',
                        }}
                      >
                        {item.ativo ? 'ATIVO' : 'INATIVO'}
                      </button>
                      <button
                        onClick={() => excluirEmail(item.id)}
                        style={{
                          padding: '8px 12px', borderRadius: 9999,
                          background: 'rgba(255,50,50,0.1)',
                          color: '#ff6060',
                          border: '1px solid rgba(255,50,50,0.4)',
                          cursor: 'pointer', fontSize: 14,
                          transition: 'all 0.15s',
                        }}
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{
        background: 'var(--surface)',
        borderTop: '2px solid var(--acid-green)',
        boxShadow: '0 -2px 20px rgba(57,255,20,0.1)',
        padding: '28px 24px',
        marginTop: 40,
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            &copy; {new Date().getFullYear()}{' '}
            <span style={{ color: 'var(--acid-green)', fontWeight: 700 }}>
              {config.nomeEmpresa || 'speceEMAIL'}
            </span>
          </p>
          <p style={{
            color: 'var(--acid-green)', fontSize: 12,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            margin: '6px 0',
          }}>
            PLANO: R$ 20,00/MÊS • 10 GB POR USUÁRIO
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
            {[
              {
                href: config.site || '#',
                label: 'Site',
                icone: <IconeGlobo size={26} />,
                corHover: 'var(--acid-green)',
              },
              {
                href: whatsappLink,
                label: 'WhatsApp',
                icone: <IconeWhatsApp size={26} />,
                corHover: '#25d366',
              },
              {
                href: instagramLink,
                label: 'Instagram',
                icone: <IconeInstagram size={26} />,
                corHover: '#E1306C',
              },
              {
                href: facebookLink,
                label: 'Facebook',
                icone: <IconeFacebook size={26} />,
                corHover: '#1877F2',
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                title={link.label}
                style={{
                  color: 'rgba(57,255,20,0.55)',
                  textDecoration: 'none',
                  transition: 'color 0.15s, transform 0.15s, filter 0.15s',
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.color = link.corHover
                  el.style.transform = 'scale(1.25)'
                  el.style.filter = `drop-shadow(0 0 8px ${link.corHover})`
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.color = 'rgba(57,255,20,0.55)'
                  el.style.transform = 'scale(1)'
                  el.style.filter = 'none'
                }}
              >
                {link.icone}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
