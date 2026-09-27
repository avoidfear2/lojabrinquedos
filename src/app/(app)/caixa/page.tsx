import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { caixaDoPeriodo, listarLocacoes } from '@/lib/dados'
import { fimDoMes, hoje, mesValido } from '@/lib/dominio/formato'
import { numeroContrato } from '@/lib/dominio/locacao'
import { nomeLocacao } from '@/components/locacao'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { TelaCaixa } from './TelaCaixa'

export const metadata: Metadata = { title: 'Caixa' }

export default async function Caixa({ searchParams }: { searchParams: Promise<{ mes?: string; tipo?: string }> }) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams])
  if (!pode.verCaixa(ctx.usuario.papel)) redirect('/inicio')
  const mes = mesValido(sp.mes) ?? hoje().slice(0, 7)
  const tipo = sp.tipo === 'entrada' || sp.tipo === 'saida' ? sp.tipo : 'todos'
  const [lanc, locs] = await Promise.all([
    caixaDoPeriodo(ctx, mes + '-01', fimDoMes(mes)),
    listarLocacoes(ctx, { status: ['orcamento', 'confirmada', 'entregue', 'concluida'], desc: true, limite: 80 }),
  ])
  const opcoesLoc = locs.map((l) => ({ id: l.id, rotulo: `${numeroContrato(l.numero, l.data_inicio)} – ${nomeLocacao(l)} – ${l.data_inicio.split('-').reverse().join('/')}` }))
  const contratos = Object.fromEntries(locs.map((l) => [l.id, numeroContrato(l.numero, l.data_inicio)]))
  return <TelaCaixa mes={mes} tipo={tipo} lancamentos={lanc} locacoes={opcoesLoc} contratos={contratos} />
}
