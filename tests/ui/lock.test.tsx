import { screen } from '@testing-library/react'
import { setup } from './helpers'

test('sem PIN: Ajustes não oferece bloqueio e o app abre direto, mesmo com um PIN antigo salvo', async () => {
  const s = await setup({ ready: true })
  // Aparelho que tinha criado PIN numa versão anterior.
  await s.repo.setDevice({ lock: { salt: 'x', hash: 'y', iterations: 1 } } as never)
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  await screen.findByRole('heading', { name: 'Ajustes' })
  expect(screen.queryByText('Bloqueio do app')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Criar PIN' })).toBeNull()
  expect(screen.queryByLabelText('PIN')).toBeNull()
})
