import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FormLocacao } from '@/components/forms/FormLocacao'
import { listarBrinquedos, obterLocacao } from '@/lib/dados'
import { numeroContrato } from '@/lib/dominio/locacao'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { Cliente } from '@/lib/tipos'

export const metadata: Metadata = { title: 'Editar locação' }

export default async function EditarLocacao({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([contexto(), params])
  if (!pode.editarLocacoes(ctx.usuario.papel)) redirect(`/locacoes/${id}`)
  const l = await obterLocacao(ctx, id)
  if (!l) notFound()
  const [{ data: clientes }, brinquedos] = await Promise.all([ctx.supabase.from('clientes').select('*').order('nome'), listarBrinquedos(ctx)])
  return (
    <>
      <Link className="voltar" href={`/locacoes/${id}`}>‹ Voltar</Link>
      <h1 className="hello">Editar locação {numeroContrato(l.numero, l.data_inicio)}</h1>
      <FormLocacao clientes={(clientes ?? []) as Cliente[]} brinquedos={brinquedos} locacao={l} />
    </>
  )
}
