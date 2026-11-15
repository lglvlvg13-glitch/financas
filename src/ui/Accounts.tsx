import { useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, Dialog, plural } from './common'
import { useUndo } from './UndoToast'
import { formatBRL, parseBRL } from '../domain/money'
import { accountBalanceCents } from '../domain/summary'
import type { Account, Transaction } from '../domain/types'

const KIND_LABEL: Record<Account['kind'], string> = { corrente: 'Conta corrente', poupanca: 'Poupança', carteira: 'Dinheiro / carteira' }

export function Accounts() {
  const accounts = useList<Account>('accounts')
  const txs = useList<Transaction>('transactions') ?? []
  const [editing, setEditing] = useState<Account | 'nova'>()
  const total = (accounts ?? []).reduce((s, a) => s + accountBalanceCents(a, txs), 0)

  return (
    <>
      <h1>Contas</h1>
      <p className="muted">Saldo somado: <strong className="num">{formatBRL(total)}</strong></p>
      {accounts && accounts.length === 0 && (
        <div className="list"><p className="empty">Nenhuma conta ainda. Cadastre onde o dinheiro de vocês fica: conta corrente, poupança ou dinheiro em mãos.</p></div>
      )}
      {accounts && accounts.length > 0 && (
        <ul className="list">
          {accounts.map(a => {
            const bal = accountBalanceCents(a, txs)
            return (
              <li key={a.id}>
                <button className="row" onClick={() => setEditing(a)}>
                  <strong>{a.name}</strong>
                  <span className={`val num ${bal < 0 ? 'saida' : ''}`}>{formatBRL(bal)}</span>
                  <span className="sub">{KIND_LABEL[a.kind]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="btns"><button className="btn" onClick={() => setEditing('nova')}>Nova conta</button></div>
      {editing && <AccountForm initial={editing === 'nova' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}

function AccountForm({ initial, onClose }: { initial?: Account; onClose: () => void }) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<Account['kind']>(initial?.kind ?? 'corrente')
  const [initialBal, setInitialBal] = useState(initial ? formatBRL(initial.initialBalanceCents).replace('R$ ', '') : '0,00')
  const [error, setError] = useState<string>()
  const [linked, setLinked] = useState<number>()

  const save = async () => {
    const cents = parseBRL(initialBal)
    if (!name.trim()) return setError('Dê um nome para a conta.')
    if (cents === null) return setError('Saldo inicial inválido.')
    await repo.put<Account>('accounts', { ...initial, name: name.trim(), kind, initialBalanceCents: cents }, me)
    onClose()
  }

  const remove = async () => {
    const affected = await repo.removeCascade('accounts', initial!.id, me)
    undo({ message: 'Conta excluída.', undo: () => repo.restoreAll(affected, me) })
    onClose()
  }

  return (
    <Dialog title={initial ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
      <div className="field">
        <label htmlFor="acc-nome">Nome</label>
        <input id="acc-nome" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Itaú, Nubank, Carteira" />
      </div>
      <div className="field">
        <label htmlFor="acc-tipo">Tipo</label>
        <select id="acc-tipo" value={kind} onChange={e => setKind(e.target.value as Account['kind'])}>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="acc-saldo">Saldo inicial (R$)</label>
        <input id="acc-saldo" inputMode="decimal" value={initialBal} onChange={e => setInitialBal(e.target.value)} />
      </div>
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        <button className="btn" onClick={save}>Salvar</button>
        <button className="btn sec" onClick={onClose}>Cancelar</button>
        {initial && <button className="btn perigo" onClick={async () => setLinked(await repo.countLinked('accounts', initial.id))}>Excluir</button>}
      </div>
      {linked !== undefined && (
        <Confirm
          title={`Excluir a conta ${initial!.name}?`}
          body={linked > 0 ? <p>Esta conta tem {plural(linked, 'lançamento', 'lançamentos')}. Eles serão excluídos junto.</p> : undefined}
          onCancel={() => setLinked(undefined)}
          actions={[{
            label: linked > 0 ? `Excluir também os ${plural(linked, 'lançamento', 'lançamentos')}` : 'Excluir',
            kind: 'perigo', run: remove,
          }]}
        />
      )}
    </Dialog>
  )
}
