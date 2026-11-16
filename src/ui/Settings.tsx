import { useEffect, useState } from 'react'
import { useApp, useProfiles } from './context'
import type { Category, Profile, ProfileId } from '../domain/types'
import { SYNC_TEXT } from './SyncBanner'

export function Settings({ go }: { go: (page: 'categorias' | 'recorrentes') => void }) {
  const { repo, me, setMe, syncStatus, syncNow } = useApp()
  const names = useProfiles()
  const [draft, setDraft] = useState(names)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  useEffect(() => { setDraft(names) }, [names.u1, names.u2]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const bad = (['u1', 'u2'] as ProfileId[]).some(id => !draft[id].trim() || draft[id].trim().length > 30)
    if (bad) { setError('Digite um nome com até 30 letras.'); return }
    setError(undefined)
    for (const id of ['u1', 'u2'] as ProfileId[]) {
      if (draft[id].trim() === names[id]) continue
      await repo.put<Profile>('profiles', { id, name: draft[id].trim() }, me)
      // A categoria de salário acompanha o nome, enquanto tiver o nome padrão.
      const sal = await repo.get<Category>('categories', `cat-salario-${id}`)
      if (sal && (sal.name === `Salário ${names[id]}` || sal.name === `Salário Usuário ${id.slice(1)}`)) {
        await repo.put<Category>('categories', { ...sal, name: `Salário ${draft[id].trim()}` }, me)
      }
    }
    setSaved(true)
  }

  return (
    <>
      <h1>Ajustes</h1>

      <h2>Quem usa este aparelho</h2>
      <div className="seg" role="group" aria-label="Quem usa este aparelho">
        {(['u1', 'u2'] as ProfileId[]).map(id => (
          <button key={id} aria-pressed={me === id} onClick={() => setMe(id)}>{names[id]}</button>
        ))}
      </div>

      <h2>Nomes dos perfis</h2>
      <div className="panel">
        {(['u1', 'u2'] as ProfileId[]).map((id, i) => (
          <div className="field" key={id}>
            <label htmlFor={`nome-${id}`}>Nome do perfil {i + 1}</label>
            <input id={`nome-${id}`} value={draft[id]} maxLength={30}
              onChange={e => { setSaved(false); setDraft({ ...draft, [id]: e.target.value }) }} />
          </div>
        ))}
        {error && <p className="err saida" role="alert">{error}</p>}
        <button className="btn" onClick={save}>Salvar nomes</button>
        {saved && <span className="muted" role="status" style={{ marginLeft: 12 }}>Nomes salvos.</span>}
      </div>

      <h2>Organização</h2>
      <div className="btns" style={{ marginTop: 0 }}>
        <button className="btn sec" onClick={() => go('categorias')}>Categorias e orçamento</button>
        <button className="btn sec" onClick={() => go('recorrentes')}>Lançamentos recorrentes</button>
      </div>

      <h2>Sincronização</h2>
      <p className="muted">{syncStatus ? SYNC_TEXT[syncStatus] : 'Aguardando a primeira sincronização.'}</p>
      <button className="btn sec" onClick={syncNow}>Sincronizar agora</button>
    </>
  )
}
