import type { LocacaoStatus } from '@/lib/tipos'

export const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Boleto']
export const CAT_ENT = ['Locação', 'Taxa de entrega', 'Caução recebida', 'Outras entradas']
export const CAT_SAI = [
  'Combustível',
  'Manutenção e reparos',
  'Ajudante ou monitor',
  'Compra de brinquedos',
  'Limpeza e higienização',
  'Marketing',
  'Impostos e taxas',
  'Devolução de caução',
  'Outras saídas',
]
export const CATS_B = ['Inflável', 'Cama elástica', 'Piscina de bolinhas', 'Tobogã', 'Jogos e mesas', 'Outro']
export const ENERGIA = ['Não precisa', '110 V', '220 V', 'Bivolt']
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

export const ST: Record<LocacaoStatus, [string, string]> = {
  orcamento: ['Orçamento', 'st-orc'],
  confirmada: ['Confirmada', 'st-conf'],
  entregue: ['Montada no local', 'st-ent'],
  concluida: ['Concluída', 'st-ok'],
  cancelada: ['Cancelada', 'st-canc'],
}

export const CHECK = {
  entrega: [
    'Brinquedos montados e ancorados',
    'Soprador e energia testados',
    'Regras de uso explicadas ao responsável',
    'Contrato e termo assinados',
  ],
  retirada: [
    'Brinquedos conferidos, sem avarias',
    'Peças, lonas e acessórios completos',
    'Saldo recebido',
    'Caução devolvida (se houver)',
  ],
} as const

export const PAPEIS = {
  dono: 'Dono',
  operador: 'Operador',
  entregador: 'Entregador',
} as const

/** Versão dos Termos de Uso aceita no cadastro. O texto fica em conteudo/termos-v<versão>.md. */
export const TERMOS_VERSAO = '1.0'
