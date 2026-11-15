import { useState } from 'react'
import { useApp, useProfiles } from './context'

export function Welcome() {
  const { signIn } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const go = async () => {
    setBusy(true); setError(undefined)
    try { await signIn() } catch (e) { setError(e instanceof Error ? e.message : 'Falha no login') }
    setBusy(false)
  }
  return (
    <main className="welcome">
      <div className="inner">
        <h1>Finanças da Família</h1>
        <p className="muted">Entre com a conta Google da família. Os dados ficam na pasta “Finanças da Família” do Drive dessa conta.</p>
        <div className="btns">
          <button className="btn" onClick={go} disabled={busy}>{busy ? 'Entrando…' : 'Entrar com Google'}</button>
        </div>
        {error && <p className="saida" role="alert">{error}. Tente de novo.</p>}
      </div>
    </main>
  )
}

export function WhoAreYou() {
  const { setMe } = useApp()
  const names = useProfiles()
  return (
    <main className="welcome">
      <div className="inner">
        <h1>Quem é você?</h1>
        <p className="muted">Os lançamentos feitos neste aparelho ficam no seu nome. Dá para trocar depois em Ajustes.</p>
        <div className="who">
          <button className="btn sec" onClick={() => setMe('u1')}>{names.u1}</button>
          <button className="btn sec" onClick={() => setMe('u2')}>{names.u2}</button>
        </div>
      </div>
    </main>
  )
}
