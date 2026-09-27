import 'server-only'

import type { Contexto } from './sessao'
import { pode } from './permissoes'
import type { Brinquedo, LancamentoCaixa, LocacaoCompleta, LocacaoStatus } from './tipos'
import type { Reserva } from './dominio/locacao'

const ITENS = 'locacao_itens(id,brinquedo_id,nome,quantidade,valor)'
const CLIENTE = 'clientes(id,nome,cpf,telefone)'

/** Select de locação: o entregador não lê clientes (RLS), então nem pedimos. */
export const selectLocacao = (ctx: Contexto) => (pode.verClientes(ctx.usuario.papel) ? `*, ${ITENS}, ${CLIENTE}` : `*, ${ITENS}`)

interface FiltroLocacoes {
  /** período que a locação toca (data_inicio <= ate e data_fim >= de) */
  de?: string
  ate?: string
  status?: LocacaoStatus[]
  clienteId?: string
  limite?: number
  desc?: boolean
}

export async function listarLocacoes(ctx: Contexto, f: FiltroLocacoes = {}) {
  let q = ctx.supabase.from('locacoes').select(selectLocacao(ctx))
  if (f.ate) q = q.lte('data_inicio', f.ate)
  if (f.de) q = q.gte('data_fim', f.de)
  if (f.status?.length) q = q.in('status', f.status)
  if (f.clienteId) q = q.eq('cliente_id', f.clienteId)
  q = q.order('data_inicio', { ascending: !f.desc }).order('hora_entrega', { ascending: !f.desc, nullsFirst: false })
  if (f.limite) q = q.limit(f.limite)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as LocacaoCompleta[]
}

export async function obterLocacao(ctx: Contexto, id: string) {
  const { data } = await ctx.supabase.from('locacoes').select(selectLocacao(ctx)).eq('id', id).maybeSingle()
  return (data ?? null) as unknown as LocacaoCompleta | null
}

/** Soma das entradas no caixa por locação (o entregador não lê o caixa: retorna vazio). */
export async function pagosPorLocacao(ctx: Contexto, ids: string[]) {
  const pagos = new Map<string, number>()
  if (!pode.verCaixa(ctx.usuario.papel) || !ids.length) return pagos
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await ctx.supabase
      .from('caixa')
      .select('locacao_id,valor')
      .eq('tipo', 'entrada')
      .in('locacao_id', ids.slice(i, i + 200))
    for (const c of data ?? []) pagos.set(c.locacao_id as string, (pagos.get(c.locacao_id as string) ?? 0) + Number(c.valor))
  }
  return pagos
}

export async function listarBrinquedos(ctx: Contexto, apenasAtivos = false) {
  let q = ctx.supabase.from('brinquedos').select('*').order('nome')
  if (apenasAtivos) q = q.eq('ativo', true)
  const { data } = await q
  return (data ?? []) as Brinquedo[]
}

/** Reservas (confirmada/entregue) que tocam o período, para calcular unidades livres. */
export async function reservasNoPeriodo(ctx: Contexto, de: string, ate: string): Promise<Reserva[]> {
  const { data } = await ctx.supabase
    .from('locacoes')
    .select('id,data_inicio,data_fim,locacao_itens(brinquedo_id,quantidade)')
    .in('status', ['confirmada', 'entregue'])
    .lte('data_inicio', ate)
    .gte('data_fim', de)
  const out: Reserva[] = []
  for (const l of (data ?? []) as { id: string; data_inicio: string; data_fim: string; locacao_itens: { brinquedo_id: string | null; quantidade: number }[] }[]) {
    for (const i of l.locacao_itens) {
      if (i.brinquedo_id) out.push({ locacao_id: l.id, data_inicio: l.data_inicio, data_fim: l.data_fim, brinquedo_id: i.brinquedo_id, quantidade: i.quantidade })
    }
  }
  return out
}

export async function caixaDoPeriodo(ctx: Contexto, de: string, ate: string) {
  const { data } = await ctx.supabase
    .from('caixa')
    .select('*')
    .gte('data', de)
    .lte('data', ate)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
  return (data ?? []) as LancamentoCaixa[]
}
