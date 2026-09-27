import type { Metadata } from 'next'
import { contexto } from '@/lib/sessao'
import type { Cliente } from '@/lib/tipos'
import { ListaClientes, type ResumoCliente } from './ListaClientes'

export const metadata: Metadata = { title: 'Clientes' }

export default async function Clientes({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams])
  const [{ data: clientes }, { data: locs }] = await Promise.all([
    ctx.supabase.from('clientes').select('*').order('nome'),
    ctx.supabase.from('locacoes').select('cliente_id,data_inicio,status'),
  ])
  const resumo: Record<string, ResumoCliente> = {}
  for (const l of locs ?? []) {
    if (!l.cliente_id) continue
    const r = (resumo[l.cliente_id] ??= { n: 0, ultima: '' })
    r.n++
    if (l.status !== 'cancelada' && l.data_inicio > r.ultima) r.ultima = l.data_inicio
  }
  return <ListaClientes clientes={(clientes ?? []) as Cliente[]} resumo={resumo} abrirNovo={sp.novo === '1'} />
}
