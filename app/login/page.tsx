'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.status === 402) {
        // Redirecionar para pagamento
        router.push(`/pagamento?emailId=${data.emailId}`)
        return
      }
      if (!res.ok) {
        setErro(data.erro || 'Erro ao fazer login.')
        return
      }
      router.push('/inbox')
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--background)', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      {/* Header mini */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ color: 'var(--acid-green)', textShadow: 'var(--glow-sm)', fontSize: 32, fontWeight: 700 }}>
          📧 speceEMAIL
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginTop: 4 }}>
          ACESSE SUA CAIXA DE E-MAIL
        </p>
      </div>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--card)',
        border: '1px solid rgba(57,255,20,0.25)',
        borderRadius: 18, padding: '36px 32px',
        boxShadow: '0 0 30px rgba(57,255,20,0.1)',
      }}>
        <h2 style={{ color: 'var(--orange)', fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
          🔐 Entrar
        </h2>

        {erro && (
          <div style={{
            background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.4)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            color: '#ff6060', fontSize: 14, textAlign: 'center',
          }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {[
            { id: 'email', label: 'Seu E-mail', type: 'email', placeholder: 'nome@seusite.com.br' },
            { id: 'senha', label: 'Senha', type: 'password', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.id} style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block', marginBottom: 6,
                color: 'var(--text-secondary)', fontSize: 12,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                required
                value={form[f.id as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))}
                style={{
                  width: '100%', padding: '13px 14px',
                  background: '#0A0C0B',
                  border: '2px solid rgba(57,255,20,0.2)',
                  borderRadius: 10, fontSize: 15, color: 'var(--text-primary)',
                  outline: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--acid-green)'; e.target.style.boxShadow = 'var(--glow-sm)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(57,255,20,0.2)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          ))}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px',
            borderRadius: 9999,
            background: loading ? 'rgba(57,255,20,0.4)' : 'var(--acid-green)',
            color: '#040505', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 16, marginTop: 8,
            boxShadow: '0 0 24px rgba(57,255,20,0.5)',
            transition: 'all 0.15s',
          }}>
            {loading ? '⏳ Entrando...' : '→ Acessar E-mail'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid rgba(57,255,20,0.1)', paddingTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Ainda não tem um e-mail?{' '}
            <Link href="/" style={{ color: 'var(--acid-green)', textDecoration: 'none', fontWeight: 600 }}>
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
