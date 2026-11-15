import { screen } from '@testing-library/react'
import { setup } from './helpers'

test('mostra Quem é você depois do login e grava a escolha', async () => {
  const { user, repo } = await setup()
  await user.click(await screen.findByRole('button', { name: 'Entrar com Google' }))
  expect(await screen.findByRole('heading', { name: 'Quem é você?' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Usuário 2' }))
  expect(await screen.findByRole('navigation')).toBeInTheDocument()
  expect((await repo.getDevice()).profileId).toBe('u2')
  expect((await repo.getDevice()).dataFileId).toBe('FILE')
})

test('renomear perfil atualiza o nome mostrado', async () => {
  const { user } = await setup({ ready: true })
  await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  const field = await screen.findByLabelText('Nome do perfil 1')
  await user.clear(field)
  await user.type(field, 'Ana')
  await user.click(screen.getByRole('button', { name: 'Salvar nomes' }))
  expect(await screen.findByRole('button', { name: 'Ana' })).toBeInTheDocument()
})

test('nome vazio não é aceito', async () => {
  const { user } = await setup({ ready: true })
  await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  const field = await screen.findByLabelText('Nome do perfil 2')
  await user.clear(field)
  await user.click(screen.getByRole('button', { name: 'Salvar nomes' }))
  expect(await screen.findByText('Digite um nome com até 30 letras.')).toBeInTheDocument()
})
