'use server'

import { cpfOk, diaValido, onlyDig } from '@/lib/dominio/formato'
import type { Resultado } from '@/lib/erros'
import { slugValido, type PedidoLink } from '@/lib/reserva/tipos'
import { supabaseAnon } from '@/lib/supabase/anon'

/** Unidades livres de cada brinquedo no período (link público, sem login). */
export async function disponibilidadeLink(slug: string, inicio: string, fim: string): Promise<Record<string, number>> {
  if (!slugValido(slug) || !diaValido(inicio) || !diaValido(fim) || fim < inicio) return {}
  const { data } = await supabaseAnon().rpc('reserva_disponibilidade', { p_slug: slug, p_inicio: inicio, p_fim: fim })
  const out: Record<string, number> = {}
  for (const x of (data ?? []) as { id: string; livres: number }[]) out[x.id] = x.livres
  return out
}

/**
 * Pedido do cliente final pelo link. Entra como ORÇAMENTO na agenda da
 * locadora, que confirma no app. Nenhum pagamento passa pela plataforma.
 */
export async function enviarPedido(slug: string, p: PedidoLink): Promise<Resultado<string>> {
  if (!slugValido(slug)) return { ok: false, erro: 'Link de reserva indisponível.' }
  const errs: string[] = []
  if (!diaValido(p.data_inicio)) errs.push('Escolha a data do evento.')
  if (p.nome.trim().length < 3) errs.push('Informe seu nome completo.')
  if (!cpfOk(p.cpf)) errs.push('CPF inválido. Confira os números.')
  if (onlyDig(p.telefone).length < 10) errs.push('Informe um telefone com DDD.')
  if (p.endereco_evento.trim().length < 5) errs.push('Informe o endereço do evento.')
  const itens = p.itens.filter((i) => i.quantidade > 0)
  if (!itens.length) errs.push('Escolha ao menos um brinquedo.')
  if (errs.length) return { ok: false, erro: errs.join('\n') }

  const { data, error } = await supabaseAnon().rpc('reserva_criar', {
    p_slug: slug,
    p: {
      nome: p.nome.trim(),
      cpf: onlyDig(p.cpf),
      telefone: onlyDig(p.telefone),
      email: p.email.trim() || null,
      data_inicio: p.data_inicio,
      data_fim: diaValido(p.data_fim) && p.data_fim >= p.data_inicio ? p.data_fim : p.data_inicio,
      hora_entrega: /^\d{2}:\d{2}$/.test(p.hora_entrega) ? p.hora_entrega : null,
      endereco_evento: p.endereco_evento.trim(),
      observacoes: p.observacoes.trim() || null,
      itens: itens.map((i) => ({ id: i.id, quantidade: Math.floor(i.quantidade) })),
    },
  })
  if (error) {
    // As mensagens da função reserva_criar já estão em português
    return { ok: false, erro: error.code === 'P0001' ? error.message : 'Não foi possível enviar o pedido. Tente de novo em instantes.' }
  }
  return { ok: true, dados: data as string }
}
