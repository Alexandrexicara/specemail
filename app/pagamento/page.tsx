'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function PagamentoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailId = searchParams.get('emailId')

  const [pix, setPix] = useState<{ pixCopiaECola: string; pixQrImage: string; orderId: string } | null>(null)
  const [status, setStatus] = useState<'carregando' | 'aguardando' | 'pago' | 'erro'>('carregando')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  const criarPagamento = useCallback(async () => {
    if (!emailId) { setErro('emailId não informado.'); setStatus('erro'); return }
    try {
      const res = await fetch('/api/pagamento/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: parseInt(emailId) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro || 'Erro ao criar pagamento.')
        setStatus('erro')
        return
      }
      setPix(data)
      setStatus('aguardando')
    } catch {
      setErro('Erro de conexão.')
      setStatus('erro')
    }
  }, [emailId])

  useEffect(() => {
    criarPagamento()
  }, [criarPagamento])

  // Polling para verificar pagamento a cada 5s
  useEffect(() => {
    if (status !== 'aguardando' || !emailId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pagamento/webhook?emailId=${emailId}`)
        const data = await res.json()
        if (data.statusPagamento === 'pago') {
          setStatus('pago')
          clearInterval(interval)
          setTimeout(() => router.push('/login'), 2500)
        }
      } catch { /* ignora */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [status, emailId, router])

  const copiarPix = () => {
    if (pix?.pixCopiaECola) {
      navigator.clipboard.writeText(pix.pixCopiaECola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--background)', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ color: 'var(--acid-green)', textShadow: 'var(--glow-sm)', fontSize: 28, fontWeight: 700 }}>
          📧 speceEMAIL
        </h1>
      </div>

      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--card)',
        border: '2px solid var(--orange)',
        borderRadius: 18, padding: '36px 32px',
        boxShadow: '0 0 30px rgba(255,159,28,0.15)',
        textAlign: 'center',
      }}>
        {status === 'carregando' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ color: 'var(--text-secondary)' }}>Gerando cobrança PIX...</p>
          </div>
        )}

        {status === 'erro' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <p style={{ color: '#ff6060', marginBottom: 20 }}>{erro}</p>
            <button onClick={criarPagamento} style={{
              padding: '12px 28px', borderRadius: 9999,
              background: 'var(--acid-green)', color: '#040505',
              border: 'none', fontWeight: 700, cursor: 'pointer',
            }}>Tentar novamente</button>
          </div>
        )}

        {status === 'aguardando' && pix && (
          <div>
            <h2 style={{ color: 'var(--orange)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
              💳 Pagamento PIX
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Escaneie o QR Code ou copie o código PIX abaixo
            </p>

            <div style={{
              background: 'rgba(57,255,20,0.05)',
              border: '1px solid rgba(57,255,20,0.2)',
              borderRadius: 12, marginBottom: 20, padding: 16,
            }}>
              <div style={{ fontSize: 42, fontWeight: 700, color: 'var(--acid-green)', textShadow: 'var(--glow-sm)', fontFamily: 'var(--font-mono)' }}>
                R$ 20,00
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                PLANO BÁSICO — 1 MÊS
              </div>
            </div>

            {pix.pixQrImage && (
              <div style={{ marginBottom: 20 }}>
                    <img
                  src={pix.pixQrImage}
                  alt="QR Code PIX"
                  style={{
                    width: 200, height: 200, borderRadius: 12,
                    border: '2px solid rgba(57,255,20,0.3)',
                    display: 'block', margin: '0 auto',
                    background: 'white', padding: 8,
                  }}
                />
              </div>
            )}

            <div style={{
              background: '#0A0C0B', border: '1px solid rgba(57,255,20,0.2)',
              borderRadius: 10, padding: 12, marginBottom: 14,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-secondary)',
              wordBreak: 'break-all', maxHeight: 72, overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {pix.pixCopiaECola || 'Código PIX gerado...'}
            </div>

            <button onClick={copiarPix} style={{
              width: '100%', padding: '13px', borderRadius: 9999,
              background: copiado ? 'rgba(57,255,20,0.15)' : 'var(--acid-green)',
              color: copiado ? 'var(--acid-green)' : '#040505',
              border: copiado ? '1px solid rgba(57,255,20,0.5)' : 'none',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 0 20px rgba(57,255,20,0.4)',
              transition: 'all 0.2s', marginBottom: 16,
            }}>
              {copiado ? '✓ Copiado!' : '📋 Copiar Código PIX'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--acid-green)', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                Aguardando confirmação do pagamento...
              </span>
            </div>
          </div>
        )}

        {status === 'pago' && (
          <div>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: 'var(--acid-green)', fontSize: 22, fontWeight: 700, textShadow: 'var(--glow-sm)' }}>
              Pagamento Confirmado!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 14 }}>
              Seu e-mail foi ativado. Redirecionando para o login...
            </p>
          </div>
        )}

        <div style={{ marginTop: 24, borderTop: '1px solid rgba(57,255,20,0.1)', paddingTop: 16 }}>
          <Link href="/login" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>
            ← Voltar para login
          </Link>
        </div>
      </div>

      {/* Ambiente Sandbox */}
      <div style={{
        marginTop: 20,
        background: 'rgba(255,159,28,0.1)', border: '1px solid rgba(255,159,28,0.3)',
        borderRadius: 9999, padding: '6px 18px',
        color: 'var(--orange)', fontSize: 12, fontFamily: 'var(--font-mono)',
      }}>
        🧪 AMBIENTE SANDBOX PAGBANK
      </div>
    </div>
  )
}

export default function PagamentoPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acid-green)' }}>Carregando...</div>}>
      <PagamentoContent />
    </Suspense>
  )
}
