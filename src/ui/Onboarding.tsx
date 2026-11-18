import { useEffect, useState } from 'react'
import { useApp, useProfiles } from './context'

export function Welcome() {
  useDarkBar()
  const { signIn } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const go = async () => {
    setBusy(true); setError(undefined)
    try { await signIn() } catch (e) { setError(e instanceof Error ? e.message : 'Falha no login') }
    setBusy(false)
  }
  return (
    <main className="login">
      <div className="login-brand"><span className="login-mark" aria-hidden="true">F</span>Finanças da Família</div>
      <div className="login-grid">
        <section className="login-copy">
          <h1>O dinheiro da casa, claro para os dois.</h1>
          <p className="login-lead">Receitas, contas, faturas e orçamento num só lugar — sincronizado entre os celulares da família.</p>
          <button className="google-btn" onClick={go} disabled={busy}>
            <GoogleG />
            <span>{busy ? 'Entrando…' : 'Entrar com Google'}</span>
          </button>
          {error && <p className="login-error" role="alert">{error}. Tente de novo.</p>}
          <p className="login-trust">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            Você digita a senha só na página do Google. Os dados ficam no Drive da sua conta.
          </p>
        </section>
        <Preview />
      </div>
      <footer className="login-foot"><a href="./sobre.html">Sobre o app</a><a href="./privacidade.html">Política de Privacidade</a></footer>
    </main>
  )
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/** Ilustração do app (valores de exemplo). */
function Preview() {
  const bars = [38, 52, 44, 66, 58, 74, 62, 81]
  return (
    <div className="login-art" aria-hidden="true">
      <div className="art-card">
        <span className="art-label">Saldo do mês</span>
        <strong className="art-total">R$ 4.280,50</strong>
        <div className="art-bars">{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <div className="art-split"><span style={{ flex: 52 }} /><span style={{ flex: 8 }} /><span style={{ flex: 40 }} /></div>
      </div>
      <div className="art-chip in"><b>Salário</b><span>+ R$ 6.500,00</span></div>
      <div className="art-chip out"><b>Mercado</b><span>− R$ 312,40</span></div>
    </div>
  )
}

export function WhoAreYou() {
  useDarkBar()
  const { setMe } = useApp()
  const names = useProfiles()
  return (
    <main className="login">
      <section className="login-copy login-solo">
        <div className="login-brand"><span className="login-mark" aria-hidden="true">F</span>Finanças da Família</div>
        <h1>Quem é você?</h1>
        <p className="login-lead">Os lançamentos feitos neste aparelho ficam no seu nome. Dá para trocar depois em Ajustes.</p>
        <div className="who-pick">
          <button onClick={() => setMe('u1')}><span className="av" aria-hidden="true">{names.u1.slice(0, 1)}</span>{names.u1}</button>
          <button onClick={() => setMe('u2')}><span className="av" aria-hidden="true">{names.u2.slice(0, 1)}</span>{names.u2}</button>
        </div>
      </section>
    </main>
  )
}

/** Barra do navegador escura enquanto a tela de entrada está aberta. */
function useDarkBar() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const before = meta?.getAttribute('content')
    meta?.setAttribute('content', '#0b0f08')
    return () => { if (before) meta?.setAttribute('content', before) }
  }, [])
}
