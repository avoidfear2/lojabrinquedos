import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obterLocacao } from '@/lib/dados'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { LancamentoCaixa, Vistoria } from '@/lib/tipos'
import { DetalheLocacao } from './DetalheLocacao'

export const metadata: Metadata = { title: 'Locação' }

export default async function PaginaLocacao({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([contexto(), params])
  const l = await obterLocacao(ctx, id)
  if (!l) notFound()
  const verCaixa = pode.verCaixa(ctx.usuario.papel)
  const [pags, vist] = await Promise.all([
    verCaixa
      ? ctx.supabase.from('caixa').select('*').eq('locacao_id', id).order('data')
      : Promise.resolve({ data: [] as LancamentoCaixa[] }),
    ctx.supabase.from('vistorias').select('*').eq('locacao_id', id),
  ])
  return (
    <>
      <Link className="voltar" href="/locacoes">‹ Locações</Link>
      <DetalheLocacao
        l={l}
        pagamentos={(pags.data ?? []) as LancamentoCaixa[]}
        vistorias={(vist.data ?? []) as Vistoria[]}
        locadora={{ nome: ctx.locadora.nome, pix: ctx.locadora.chave_pix }}
      />
    </>
  )
}
