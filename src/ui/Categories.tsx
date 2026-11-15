import { useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, Dialog, plural } from './common'
import { useUndo } from './UndoToast'
import { formatBRL, parseBRL } from '../domain/money'
import type { Category } from '../domain/types'

export function Categories() {
  const cats = useList<Category>('categories') ?? []
  const [editing, setEditing] = useState<Category | Category['kind']>()

  const section = (kind: Category['kind'], title: string) => (
    <>
      <h2>{title}</h2>
      <ul className="list">
        {cats.filter(c => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(c => (
          <li key={c.id}>
            <button className="row" onClick={() => setEditing(c)}>
              <strong>{c.name}</strong>
              <span className="val num muted">{c.monthlyBudgetCents ? formatBRL(c.monthlyBudgetCents) : ''}</span>
              <span className="sub">{c.system ? 'Usada pelo app nos pagamentos de fatura' : c.monthlyBudgetCents ? 'Orçamento mensal' : 'Sem orçamento'}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="btns"><button className="btn sec" onClick={() => setEditing(kind)}>Nova categoria de {kind}</button></div>
    </>
  )

  return (
    <>
      <h1>Categorias e orçamento</h1>
      <p className="muted">O orçamento mensal aparece no Resumo como uma barra que fica vermelha quando passa do limite.</p>
      {section('despesa', 'Despesas')}
      {section('receita', 'Receitas')}
      {editing && (
        <CategoryForm
          initial={typeof editing === 'string' ? undefined : editing}
          kind={typeof editing === 'string' ? editing : editing.kind}
          others={cats}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}

function CategoryForm({ initial, kind, others, onClose }: {
  initial?: Category; kind: Category['kind']; others: Category[]; onClose: () => void
}) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const [name, setName] = useState(initial?.name ?? '')
  const [budget, setBudget] = useState(initial?.monthlyBudgetCents ? formatBRL(initial.monthlyBudgetCents).replace('R$ ', '') : '')
  const [error, setError] = useState<string>()
  const [linked, setLinked] = useState<number>()
  const targets = others.filter(c => c.kind === kind && c.id !== initial?.id && !c.system)
  const [moveTo, setMoveTo] = useState(targets[0]?.id ?? '')

  const save = async () => {
    if (!name.trim()) return setError('Dê um nome para a categoria.')
    const cents = budget.trim() ? parseBRL(budget) : undefined
    if (cents === null) return setError('Orçamento inválido.')
    const rec: Partial<Category> = { ...initial, name: name.trim(), kind }
    if (cents) rec.monthlyBudgetCents = cents
    else delete rec.monthlyBudgetCents
    await repo.put<Category>('categories', rec as Category, me)
    onClose()
  }

  const remove = async (opts: { moveToCategoryId?: string }) => {
    const ids = await repo.removeCascade('categories', initial!.id, me, opts)
    undo({ message: 'Categoria excluída.', undo: async () => {
      await repo.restore('categories', ids[0], me)
      for (const id of ids.slice(1)) await repo.restore('transactions', id, me)
    } })
    onClose()
  }

  return (
    <Dialog title={initial ? 'Editar categoria' : `Nova categoria de ${kind}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="cat-nome">Nome</label>
        <input id="cat-nome" value={name} disabled={initial?.system} onChange={e => setName(e.target.value)} />
      </div>
      {kind === 'despesa' && !initial?.system && (
        <div className="field">
          <label htmlFor="cat-orc">Orçamento mensal (R$, opcional)</label>
          <input id="cat-orc" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Sem limite" />
        </div>
      )}
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        {!initial?.system && <button className="btn" onClick={save}>Salvar</button>}
        <button className="btn sec" onClick={onClose}>{initial?.system ? 'Fechar' : 'Cancelar'}</button>
        {initial && !initial.system && (
          <button className="btn perigo" onClick={async () => setLinked(await repo.countLinked('categories', initial.id))}>Excluir</button>
        )}
      </div>
      {linked !== undefined && (
        <Confirm
          title={`Excluir a categoria ${initial!.name}?`}
          onCancel={() => setLinked(undefined)}
          body={linked > 0 && (
            <>
              <p>{plural(linked, 'lançamento usa', 'lançamentos usam')} esta categoria.</p>
              {targets.length > 0 && (
                <div className="field">
                  <label htmlFor="cat-mover">Mover os lançamentos para</label>
                  <select id="cat-mover" value={moveTo} onChange={e => setMoveTo(e.target.value)}>
                    {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          actions={linked > 0
            ? [
              ...(targets.length ? [{ label: 'Mover e excluir a categoria', run: () => remove({ moveToCategoryId: moveTo }) }] : []),
              { label: `Excluir também os ${plural(linked, 'lançamento', 'lançamentos')}`, kind: 'perigo' as const, run: () => remove({}) },
            ]
            : [{ label: 'Excluir', kind: 'perigo', run: () => remove({}) }]}
        />
      )}
    </Dialog>
  )
}
