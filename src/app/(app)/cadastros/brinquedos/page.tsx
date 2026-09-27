import type { Metadata } from 'next'
import { listarBrinquedos } from '@/lib/dados'
import { contexto } from '@/lib/sessao'
import { ListaBrinquedos } from './ListaBrinquedos'

export const metadata: Metadata = { title: 'Brinquedos' }

export default async function Brinquedos({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams])
  const brinquedos = await listarBrinquedos(ctx)
  return <ListaBrinquedos brinquedos={brinquedos} abrirNovo={sp.novo === '1'} plano={ctx.plano?.plano ?? 'essencial'} />
}
