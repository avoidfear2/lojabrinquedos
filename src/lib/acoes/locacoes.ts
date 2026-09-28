'use server'

import { cpfOk, diaValido, fTel, onlyDig } from '@/lib/dominio/formato'
import { garantirDocumento } from '@/lib/documentos/servidor'
import { enderecoCliente } from '@/lib/dominio/locacao'
import type { Resultado } from '@/lib/erros'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { Cliente, LocacaoStatus, VistoriaFase } from '@/lib/tipos'
import { falha, semPermissao, sucesso } from './comum'
import type { EntradaLocacao } from './tipos'

const STATUS_FORM: LocacaoStatus[] = ['orcamento', 'confirmada', 'cancelada']

/** Grava locação e itens numa transação só (função salvar_locacao, migração 002). */
export async function salvarLocacao(d: EntradaLocacao): Promise<Resultado<string>> {
  const ctx = await contexto()
  if (!pode.editarLocacoes(ctx.usuario.papel)) return semPermissao

  const errs: string[] = []
  if (!d.cliente_id) errs.push('Escolha o cliente.')
  if (!diaValido(d.data_inicio)) errs.push('Informe a data da entrega.')
  const fim = diaValido(d.data_fim) ?? d.data_inicio
  if (fim < d.data_inicio) errs.push('A retirada não pode ser antes da entrega.')
  const itens = (d.itens ?? []).filter((i) => Number(i.quantidade) > 0)
  if (!itens.length) errs.push('Adicione pelo menos um brinquedo.')
  if (!d.mesmo_endereco && !d.endereco_evento?.trim()) errs.push('Informe o endereço do evento.')
  if (!d.resp_cliente) {
    if (!d.resp_nome?.trim()) errs.push('Informe o nome do responsável no local.')
    if (!cpfOk(d.resp_cpf)) errs.push('CPF do responsável inválido.')
  }
  if (errs.length) return { ok: false, erro: errs.join('\n') }

  // Status: o formulário só escolhe orçamento/confirmada/cancelada; entregue e
  // concluída vêm da vistoria e são mantidos ao editar.
  let status: LocacaoStatus = STATUS_FORM.includes(d.status) ? d.status : 'orcamento'
  if (d.id) {
    const { data: atual } = await ctx.supabase.from('locacoes').select('status').eq('id', d.id).maybeSingle()
    if (!atual) return { ok: false, erro: 'Locação não encontrada.' }
    if ((atual.status === 'entregue' || atual.status === 'concluida') && !STATUS_FORM.includes(d.status)) status = atual.status
  }

  const { data: cli } = await ctx.supabase.from('clientes').select('*').eq('id', d.cliente_id).maybeSingle<Cliente>()
  if (!cli) return { ok: false, erro: 'Cliente não encontrado.' }

  // Responsável no local: quando é o próprio cliente, copiamos nome e telefone
  // para a locação — é o contato que o entregador (que não lê clientes) enxerga.
  const resp = d.resp_cliente
    ? { resp_nome: cli.nome, resp_cpf: cli.cpf, resp_telefone: cli.telefone ?? '' }
    : { resp_nome: d.resp_nome.trim(), resp_cpf: onlyDig(d.resp_cpf), resp_telefone: fTel(d.resp_telefone) }

  const p = {
    id: d.id || null,
    cliente_id: cli.id,
    data_inicio: d.data_inicio,
    data_fim: fim,
    hora_entrega: d.hora_entrega || null,
    hora_retirada: d.hora_retirada || null,
    endereco_evento: d.mesmo_endereco ? enderecoCliente(cli) || '—' : d.endereco_evento.trim(),
    ...resp,
    frete: Math.max(0, Number(d.frete) || 0),
    desconto: Math.max(0, Number(d.desconto) || 0),
    caucao: Math.max(0, Number(d.caucao) || 0),
    forma_pagamento: d.forma_pagamento || null,
    condicoes: d.condicoes?.trim() || null,
    status,
    observacoes: d.observacoes?.trim() || null,
    itens: itens.map((i) => ({
      brinquedo_id: i.brinquedo_id,
      nome: i.nome,
      quantidade: Math.max(1, Math.floor(Number(i.quantidade))),
      valor: Math.max(0, Number(i.valor) || 0),
    })),
  }
  const { data, error } = await ctx.supabase.rpc('salvar_locacao', { p })
  if (error) return falha(ctx, error)
  // Locação confirmada já fica com o contrato pronto para assinar (inclusive pelo entregador)
  if (status === 'confirmada') await garantirDocumento(ctx, data as string).catch(() => null)
  return sucesso(data as string, d.id ? 'Locação atualizada' : 'Locação registrada')
}

export async function mudarStatus(id: string, status: 'confirmada' | 'cancelada' | 'orcamento'): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarLocacoes(ctx.usuario.papel)) return semPermissao
  if (!['confirmada', 'cancelada', 'orcamento'].includes(status)) return { ok: false, erro: 'Situação inválida.' }
  const { error, count } = await ctx.supabase.from('locacoes').update({ status }, { count: 'exact' }).eq('id', id)
  if (error) return falha(ctx, error)
  if (!count) return { ok: false, erro: 'Locação não encontrada ou sem permissão.' }
  if (status === 'confirmada') await garantirDocumento(ctx, id).catch(() => null)
  const msg = { confirmada: 'Reserva confirmada', cancelada: 'Locação cancelada', orcamento: 'Voltou para orçamento' }[status]
  return sucesso(undefined, msg)
}

export async function excluirLocacao(id: string): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarLocacoes(ctx.usuario.papel)) return semPermissao
  const { error, count } = await ctx.supabase.from('locacoes').delete({ count: 'exact' }).eq('id', id)
  if (error) return falha(ctx, error)
  if (!count) return { ok: false, erro: 'Locação não encontrada ou sem permissão.' }
  return sucesso(undefined, 'Locação excluída. Os lançamentos no caixa foram mantidos.')
}

/** Entrega e retirada (toda a equipe, inclusive entregador), pela função registrar_vistoria. */
export async function registrarVistoria(id: string, fase: VistoriaFase, itens: string[], obs: string): Promise<Resultado> {
  const ctx = await contexto()
  if (fase !== 'entrega' && fase !== 'retirada') return { ok: false, erro: 'Fase inválida.' }
  const { data: l } = await ctx.supabase.from('locacoes').select('status').eq('id', id).maybeSingle()
  if (!l) return { ok: false, erro: 'Locação não encontrada.' }
  if (fase === 'entrega' && l.status !== 'confirmada') return { ok: false, erro: 'Só dá para registrar a entrega de uma locação confirmada.' }
  if (fase === 'retirada' && l.status !== 'entregue') return { ok: false, erro: 'Registre a entrega antes da retirada.' }
  const { error } = await ctx.supabase.rpc('registrar_vistoria', {
    p_locacao: id,
    p_fase: fase,
    p_itens: itens.map((s) => String(s).slice(0, 200)).slice(0, 20),
    p_obs: obs?.trim() || null,
  })
  if (error) return falha(ctx, error)
  return sucesso(undefined, fase === 'entrega' ? 'Entrega registrada' : 'Retirada registrada – locação concluída')
}
