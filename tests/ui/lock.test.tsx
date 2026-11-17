import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setup } from './helpers'
import App from '../../src/ui/App'

test('criar PIN em Ajustes, app trava ao abrir, PIN errado não abre, certo abre', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  await s.user.click(await screen.findByRole('button', { name: 'Criar PIN' }))
  const dlg = await screen.findByRole('dialog')
  await s.user.type(within(dlg).getByLabelText('Novo PIN (4 a 8 números)'), '4821')
  await s.user.type(within(dlg).getByLabelText('Repita o PIN'), '4821')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar PIN' }))
  await waitFor(async () => expect((await s.repo.getDevice()).lock).toBeDefined())

  // Abre o app de novo (outra vez no mesmo aparelho).
  s.unmount()
  const user = userEvent.setup()
  render(<App deps={{ repo: s.repo, requestToken: async () => ({ accessToken: 'T', expiresAt: Date.now() + 3e6 }), makeDrive: () => s.drive }} />)
  const pin = await screen.findByLabelText('PIN')
  expect(screen.queryByRole('navigation')).toBeNull()
  await user.type(pin, '1111')
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('PIN errado')
  await user.clear(pin)
  await user.type(pin, '4821')
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
  expect(await screen.findByRole('navigation')).toBeInTheDocument()
})

test('PINs diferentes não são aceitos', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  await s.user.click(await screen.findByRole('button', { name: 'Criar PIN' }))
  const dlg = await screen.findByRole('dialog')
  await s.user.type(within(dlg).getByLabelText('Novo PIN (4 a 8 números)'), '4821')
  await s.user.type(within(dlg).getByLabelText('Repita o PIN'), '4822')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar PIN' }))
  expect(await within(dlg).findByText('Os dois PINs não são iguais.')).toBeInTheDocument()
  expect((await s.repo.getDevice()).lock).toBeUndefined()
})
