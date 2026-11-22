import { screen } from '@testing-library/react'
import { setup } from './helpers'

test('Manual de uso abre pela aba Mais, com os temas e as fotos', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Manual de uso' }))
  expect(await screen.findByRole('heading', { name: 'Manual de uso' })).toBeInTheDocument()
  for (const t of ['1. Comece aqui', '3. Lançar gastos e receitas', '6. Planejamento e metas', '9. Dúvidas rápidas'])
    expect(screen.getByText(t)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Tela de entrada com o botão Entrar com Google destacado' })).toHaveAttribute('src', expect.stringContaining('manual/01-entrar.webp'))
  expect(screen.queryByText(/PIN/)).toBeNull()
})
