export type Page = 'resumo' | 'lancamentos' | 'cartoes' | 'contas' | 'ajustes' | 'categorias' | 'recorrentes'

/** Telas principais (preenchidas nas próximas tarefas). */
export function Pages({ page }: { page: Exclude<Page, 'ajustes'>; go: (p: Page) => void }) {
  return <h1>{page}</h1>
}
