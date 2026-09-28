import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { faltandoNoLocador } from '@/lib/documentos/modelo'
import { estadoDocumento } from '@/lib/documentos/servidor'
import { fDataHora } from '@/lib/dominio/formato'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { TelaDocumento } from './TelaDocumento'

export const metadata: Metadata = { title: 'Contrato e termo' }

export default async function Documento({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([contexto(), params])
  const { data: l } = await ctx.supabase.from('locacoes').select('id,numero,data_inicio').eq('id', id).maybeSingle()
  if (!l) notFound()
  const e = await estadoDocumento(ctx, id)
  const escritorio = pode.editarLocacoes(ctx.usuario.papel)

  // Houve assinaturas numa versão anterior? (a locação mudou depois de assinada)
  let assinadaAntes = false
  if (e.desatualizado ? e.assinaturas.length > 0 : e.gravado && e.assinaturas.length === 0) {
    if (e.desatualizado) assinadaAntes = true
    else {
      const { data: antigas } = await ctx.supabase.from('documentos').select('id').eq('locacao_id', id).neq('id', e.gravado!.id)
      const ids = (antigas ?? []).map((d) => d.id as string)
      if (ids.length) {
        const { count } = await ctx.supabase.from('assinaturas_doc').select('id', { count: 'exact', head: true }).in('documento_id', ids)
        assinadaAntes = !!count
      }
    }
  }

  // Assinaturas valem para a versão gravada; se a locação mudou, a versão nova começa sem assinaturas
  const vale = e.desatualizado ? [] : e.assinaturas
  const assinados = Object.fromEntries(vale.map((a) => [a.papel, fDataHora(a.assinado_em)]))
  const pendentes = (['locatario', 'responsavel', 'locador'] as const)
    .filter((p) => e.partes[p])
    .map((p) => ({ papel: p, nome: e.partes[p]!.nome, assinadoEm: assinados[p] ?? null }))

  return (
    <>
      <Link className="voltar" href={`/locacoes/${id}`}>‹ Voltar</Link>
      <TelaDocumento
        locacaoId={id}
        titulo="Contrato e termo"
        existe={!!e.gravado || !!e.atual}
        escritorio={escritorio}
        faltaAjustes={escritorio ? faltandoNoLocador(ctx.locadora) : []}
        mudou={assinadaAntes}
        partes={pendentes}
        versao={(e.atual?.hash ?? e.gravado?.hash_sha256 ?? '').slice(0, 12) + '-' + vale.length}
      />
    </>
  )
}
