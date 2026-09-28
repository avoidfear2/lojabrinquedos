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
  // Fotos das vistorias: links temporários (o bucket é privado; a RLS do Storage decide quem vê)
  const caminhos = ((vist.data ?? []) as Vistoria[]).flatMap((v) => v.fotos ?? [])
  const fotosUrls: Record<string, string> = {}
  if (caminhos.length) {
    const { data: urls } = await ctx.supabase.storage.from('vistorias').createSignedUrls(caminhos, 3600)
    for (const u of urls ?? []) if (u.path && u.signedUrl) fotosUrls[u.path] = u.signedUrl
  }
  // Contrato: a última versão gravada já tem a assinatura do locatário?
  const { data: docs } = await ctx.supabase.from('documentos').select('id').eq('locacao_id', id).order('criado_em', { ascending: false }).limit(1)
  const docId = (docs ?? [])[0]?.id as string | undefined
  const { count: assinou } = docId
    ? await ctx.supabase.from('assinaturas_doc').select('id', { count: 'exact', head: true }).eq('documento_id', docId).eq('papel', 'locatario')
    : { count: 0 }
  return (
    <>
      <Link className="voltar" href="/locacoes">‹ Locações</Link>
      <DetalheLocacao
        l={l}
        pagamentos={(pags.data ?? []) as LancamentoCaixa[]}
        vistorias={(vist.data ?? []) as Vistoria[]}
        locadora={{ nome: ctx.locadora.nome, pix: ctx.locadora.chave_pix }}
        contratoAssinado={!!assinou}
        fotosUrls={fotosUrls}
      />
    </>
  )
}
