import type { LocacaoStatus } from '@/lib/tipos'

/** Dados do formulário de locação enviados à ação salvarLocacao. */
export interface EntradaLocacao {
  id?: string
  cliente_id: string
  data_inicio: string
  data_fim: string
  hora_entrega: string
  hora_retirada: string
  mesmo_endereco: boolean
  endereco_evento: string
  resp_cliente: boolean
  resp_nome: string
  resp_cpf: string
  resp_telefone: string
  frete: number
  desconto: number
  caucao: number
  forma_pagamento: string
  condicoes: string
  status: LocacaoStatus
  observacoes: string
  itens: { brinquedo_id: string | null; nome: string; quantidade: number; valor: number }[]
}
