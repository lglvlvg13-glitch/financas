import { useEffect, useRef, useState } from 'react'
import { useApp } from './context'
import { Dialog } from './common'
import { checkPin, makePinLock, verifyBiometrics, biometricsAvailable, registerBiometrics } from '../security/pin'

const RELOCK_MS = 5 * 60_000

/** Trava o app ao abrir e depois de 5 minutos em segundo plano, se houver PIN neste aparelho. */
export function useLockState(): [boolean, () => void] {
  const { device } = useApp()
  const [unlocked, setUnlocked] = useState(false)
  const hiddenAt = useRef<number | undefined>(undefined)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_MS) setUnlocked(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  const locked = !!device?.lock && !unlocked
  return [locked, () => setUnlocked(true)]
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { device } = useApp()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string>()
  const [fails, setFails] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [, tick] = useState(0)
  const lock = device!.lock!
  const waiting = waitUntil > Date.now()

  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => tick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [waiting])

  const tryBio = async () => { if (lock.credentialId && await verifyBiometrics(lock.credentialId)) onUnlock() }
  useEffect(() => { if (lock.credentialId) void tryBio() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (waiting) return
    if (await checkPin(lock, pin)) { onUnlock(); return }
    const n = fails + 1
    setFails(n); setPin('')
    if (n % 5 === 0) { setWaitUntil(Date.now() + 30_000); setError('PIN errado 5 vezes. Espere 30 segundos.') }
    else setError('PIN errado. Tente de novo.')
  }

  return (
    <main className="welcome">
      <form className="inner lock" onSubmit={submit}>
        <h1>Finanças da Família</h1>
        <p className="muted">Digite o PIN deste aparelho.</p>
        <div className="field">
          <label htmlFor="pin">PIN</label>
          <input id="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={8}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        </div>
        {error && <p className="err saida" role="alert">{waiting ? `${error} (${Math.ceil((waitUntil - Date.now()) / 1000)} s)` : error}</p>}
        <div className="btns">
          <button className="btn" type="submit" disabled={waiting || pin.length < 4}>Desbloquear</button>
          {lock.credentialId && <button className="btn sec" type="button" onClick={tryBio}>Usar digital</button>}
        </div>
        <p className="hint" style={{ marginTop: 18 }}>Esqueceu o PIN? Os dados estão no Google Drive da família: apague os dados do app nas configurações do navegador e entre de novo com a conta Google.</p>
      </form>
    </main>
  )
}

/** Seção "Bloqueio do app" em Ajustes. */
export function LockSettings() {
  const { repo, device } = useApp()
  const [open, setOpen] = useState(false)
  const [bio, setBio] = useState(false)
  const [msg, setMsg] = useState<string>()
  useEffect(() => { void biometricsAvailable().then(setBio) }, [])
  const lock = device?.lock

  const addBio = async () => {
    try {
      const credentialId = await registerBiometrics()
      await repo.setDevice({ lock: { ...lock!, credentialId } })
      setMsg('Digital ativada neste aparelho.')
    } catch { setMsg('Não foi possível ativar a digital neste aparelho.') }
  }

  return (
    <>
      <h2>Bloqueio do app</h2>
      <p className="muted">Pede um PIN ao abrir o app e depois de 5 minutos fora dele. Vale só para este aparelho.</p>
      <div className="btns" style={{ marginTop: 0 }}>
        {!lock && <button className="btn sec" onClick={() => setOpen(true)}>Criar PIN</button>}
        {lock && <button className="btn sec" onClick={() => setOpen(true)}>Trocar PIN</button>}
        {lock && bio && !lock.credentialId && <button className="btn sec" onClick={addBio}>Usar digital também</button>}
        {lock && <button className="btn perigo" onClick={async () => { await repo.setDevice({ lock: null }); setMsg('Bloqueio desligado.') }}>Tirar o bloqueio</button>}
      </div>
      {msg && <p className="muted" role="status">{msg}</p>}
      {open && <PinForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setMsg('PIN salvo. O app vai pedir o PIN ao abrir.') }} />}
    </>
  )
}

function PinForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { repo } = useApp()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState<string>()
  const save = async () => {
    if (!/^\d{4,8}$/.test(a)) return setError('Use de 4 a 8 números.')
    if (a !== b) return setError('Os dois PINs não são iguais.')
    await repo.setDevice({ lock: await makePinLock(a) })
    onSaved()
  }
  return (
    <Dialog title="PIN deste aparelho" onClose={onClose}>
      <div className="field">
        <label htmlFor="pin-a">Novo PIN (4 a 8 números)</label>
        <input id="pin-a" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={a} onChange={e => setA(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="field">
        <label htmlFor="pin-b">Repita o PIN</label>
        <input id="pin-b" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={b} onChange={e => setB(e.target.value.replace(/\D/g, ''))} />
      </div>
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        <button className="btn" onClick={save}>Salvar PIN</button>
        <button className="btn sec" onClick={onClose}>Cancelar</button>
      </div>
    </Dialog>
  )
}
