import type { LocacaoStatus } from '@/lib/tipos'
import { datas } from './formato'

export interface ItemValor {
  quantidade: number
  valor: number | string
}
export interface LocacaoValores {
  frete: number | string
  desconto: number | string
  itens: ItemValor[]
}

export const subtotal = (l: { itens: ItemValor[] }) => l.itens.reduce((a, i) => a + Number(i.quantidade) * Number(i.valor), 0)
export const total = (l: LocacaoValores) => subtotal(l) + Number(l.frete || 0) - Number(l.desconto || 0)

/** Locações que ocupam o brinquedo (mesma regra do banco). */
export const bloqueia = (s: LocacaoStatus) => s === 'confirmada' || s === 'entregue'
/** Locações que geram valor a receber. */
export const cobra = (s: LocacaoStatus) => s === 'confirmada' || s === 'entregue' || s === 'concluida'

export const numeroContrato = (numero: number, dataInicio: string) =>
  String(numero || 0).padStart(4, '0') + '/' + (dataInicio || '').slice(0, 4)

export interface Reserva {
  locacao_id: string
  data_inicio: string
  data_fim: string
  brinquedo_id: string
  quantidade: number
}

/** Quantas unidades estão reservadas no dia, ignorando uma locação (a que está sendo editada). */
export function reservado(reservas: Reserva[], brinquedoId: string, dia: string, ignorar?: string | null) {
  let s = 0
  for (const r of reservas) {
    if (r.brinquedo_id !== brinquedoId || r.locacao_id === ignorar) continue
    if (r.data_inicio <= dia && r.data_fim >= dia) s += r.quantidade
  }
  return s
}

/** Menor número de unidades livres em qualquer dia do período. */
export function livresNoPeriodo(
  quantidade: number,
  reservas: Reserva[],
  brinquedoId: string,
  inicio: string,
  fim: string,
  ignorar?: string | null,
) {
  let min = quantidade
  for (const d of datas(inicio, fim < inicio ? inicio : fim)) {
    min = Math.min(min, quantidade - reservado(reservas, brinquedoId, d, ignorar))
  }
  return Math.max(0, min)
}

/** Conflitos para mostrar antes de salvar (o banco faz a checagem definitiva). */
export function conflitos(
  itens: { brinquedo_id: string; nome: string; quantidade: number; estoque: number }[],
  reservas: Reserva[],
  inicio: string,
  fim: string,
  ignorar?: string | null,
) {
  const out: string[] = []
  for (const it of itens) {
    for (const d of datas(inicio, fim)) {
      const lv = it.estoque - reservado(reservas, it.brinquedo_id, d, ignorar)
      if (it.quantidade > lv) {
        out.push(`${it.nome} em ${d.split('-').reverse().join('/')}: ${Math.max(lv, 0)} livre(s), pedido ${it.quantidade}`)
        break
      }
    }
  }
  return out
}

export interface EnderecoCliente {
  rua?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}
export function enderecoCliente(c: EnderecoCliente | null | undefined) {
  if (!c) return ''
  return [
    c.rua ? c.rua + (c.numero ? ', ' + c.numero : '') : '',
    c.complemento,
    c.bairro,
    c.cidade ? c.cidade + (c.uf ? '/' + c.uf : '') : '',
    c.cep ? 'CEP ' + c.cep : '',
  ]
    .filter(Boolean)
    .join(', ')
}
