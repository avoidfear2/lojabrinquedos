import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FormLocacao } from '@/components/forms/FormLocacao'
import { listarBrinquedos } from '@/lib/dados'
import { diaValido, hoje } from '@/lib/dominio/formato'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { Cliente } from '@/lib/tipos'

export const metadata: Metadata = { title: 'Nova locação' }

export default async function NovaLocacao({ searchParams }: { searchParams: Promise<{ dia?: string; cliente?: string }> }) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams])
  if (!pode.editarLocacoes(ctx.usuario.papel)) redirect('/locacoes')
  const [{ data: clientes }, brinquedos] = await Promise.all([ctx.supabase.from('clientes').select('*').order('nome'), listarBrinquedos(ctx)])
  return (
    <>
      <Link className="voltar" href="/locacoes">‹ Locações</Link>
      <h1 className="hello">Nova locação</h1>
      <FormLocacao clientes={(clientes ?? []) as Cliente[]} brinquedos={brinquedos} dia={diaValido(sp.dia) ?? hoje()} clienteInicial={sp.cliente} />
    </>
  )
}
