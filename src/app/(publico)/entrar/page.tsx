import type { Metadata } from 'next'
import { FormEntrar } from './FormEntrar'

export const metadata: Metadata = { title: 'Entrar' }

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return (
    <>
      <h1>Sua locadora organizada</h1>
      <p className="lead">Agenda, locações, clientes, brinquedos e caixa num só lugar, no celular.</p>
      {erro === 'link' && <div className="warn">O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.</div>}
      <FormEntrar />
    </>
  )
}
