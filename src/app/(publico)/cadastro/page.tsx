import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { usuarioLogado } from '@/lib/sessao'
import { FormCadastro } from './FormCadastro'

export const metadata: Metadata = { title: 'Cadastro da locadora' }

export default async function Cadastro() {
  const u = await usuarioLogado()
  if (!u) redirect('/entrar')
  const { data } = await u.supabase.from('usuarios').select('id').eq('id', u.uid).maybeSingle()
  if (data) redirect('/inicio')
  return (
    <>
      <h1>Cadastre sua locadora</h1>
      <p className="lead">São só três informações. Endereço, Pix e condições você completa depois em Ajustes.</p>
      <FormCadastro email={u.email} />
      <form action="/auth/sair" method="post" className="troca">
        <button className="lnk">Sair e usar outro e-mail</button>
      </form>
    </>
  )
}
