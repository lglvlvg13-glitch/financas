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
              <span className="sub">{c.system ? 'Usada pelo app nos pagamentos de fatura'
                : [kind === 'despesa' ? (c.group === 'necessidade' ? 'Necessidade' : 'Desejo') : '', c.monthlyBudgetCents ? 'orçamento mensal' : ''].filter(Boolean).join(', ') || ' '}</span>
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
      <p className="muted">O orçamento mensal aparece no Resumo, proporcional ao período escolhido. Necessidade ou Desejo define em que parte do método 50/30/20 a despesa entra.</p>
      {section('despesa', 'Despesas')}
      {section('receita', 'Receitas')}
      {section('investimento', 'Investimentos')}
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
  const [group, setGroup] = useState<'necessidade' | 'desejo'>(initial?.group ?? 'desejo')
  type Item = NonNullable<Category['items']>[number]
  const [items, setItems] = useState<Item[]>(initial?.items ?? [])
  const [newItem, setNewItem] = useState('')
  const setItemGroup = (name: string, g: Item['group']) => setItems(items.map(x => x.name === name ? { ...x, group: g } : x))
  const addItem = () => {
    const name = newItem.trim()
    if (!name || items.some(x => x.name.toLowerCase() === name.toLowerCase())) return
    setItems([...items, { name, group }]); setNewItem('')
  }
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
    if (kind === 'despesa') {
      rec.group = group
      if (items.length) rec.items = items
      else delete rec.items
    } else { delete rec.group; delete rec.items }
    if (cents) rec.monthlyBudgetCents = cents
    else delete rec.monthlyBudgetCents
    await repo.put<Category>('categories', rec as Category, me)
    onClose()
  }

  const remove = async (opts: { moveToCategoryId?: string }) => {
    const affected = await repo.removeCascade('categories', initial!.id, me, opts)
    undo({ message: 'Categoria excluída.', undo: () => repo.restoreAll(affected, me) })
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
          <span className="lbl">No método 50/30/20{items.length ? ' (quando o item não for escolhido)' : ''}</span>
          <div className="seg" role="group" aria-label="No método 50/30/20">
            <button aria-pressed={group === 'necessidade'} onClick={() => setGroup('necessidade')}>Necessidade</button>
            <button aria-pressed={group === 'desejo'} onClick={() => setGroup('desejo')}>Desejo</button>
          </div>
        </div>
      )}
      {kind === 'despesa' && !initial?.system && (
        <div className="field">
          <span className="lbl">Itens e classificação</span>
          <span className="hint">Necessidade = despesa fixa, que não dá para cortar. Desejo = dá para cortar ou adiar. Ao lançar, escolher o item já classifica.</span>
          <ul className="items-edit">
            {items.map(x => (
              <li key={x.name} role="group" aria-label={x.name}>
                <span>{x.name}</span>
                <div className="seg small">
                  <button aria-pressed={x.group === 'necessidade'} onClick={() => setItemGroup(x.name, 'necessidade')}>Necessidade</button>
                  <button aria-pressed={x.group === 'desejo'} onClick={() => setItemGroup(x.name, 'desejo')}>Desejo</button>
                </div>
                <button className="x" aria-label={`Tirar o item ${x.name}`} onClick={() => setItems(items.filter(y => y.name !== x.name))}>×</button>
              </li>
            ))}
          </ul>
          <div className="add-item">
            <input aria-label="Novo item" placeholder="Novo item (ex.: Padaria)" value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem() }} />
            <button className="mini" onClick={addItem}>Adicionar item</button>
          </div>
        </div>
      )}
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
