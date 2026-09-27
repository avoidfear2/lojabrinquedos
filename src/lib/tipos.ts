// Tipos do banco (espelham supabase/migrations). Quando houver um projeto
// Supabase ligado, dá para trocar por `supabase gen types typescript`.

export type Papel = 'dono' | 'operador' | 'entregador'
export type PlanoTipo = 'essencial' | 'profissional' | 'equipe'
export type PlanoStatus = 'teste' | 'ativa' | 'atrasada' | 'cancelada'
export type LocacaoStatus = 'orcamento' | 'confirmada' | 'entregue' | 'concluida' | 'cancelada'
export type CaixaTipo = 'entrada' | 'saida'
export type VistoriaFase = 'entrega' | 'retirada'

export interface Locadora {
  id: string
  nome: string
  cpf_cnpj: string
  telefone: string | null
  endereco: string | null
  cidade: string | null
  comarca_foro: string | null
  chave_pix: string | null
  canc_dias: number
  canc_pct: number
  taxa_visita: number
  clausulas_extras: string | null
  slug: string | null
  proximo_numero: number
  criado_em: string
}
export interface Usuario {
  id: string
  locadora_id: string
  nome: string
  papel: Papel
  ativo: boolean
  criado_em: string
}
export interface AssinaturaPlano {
  locadora_id: string
  plano: PlanoTipo
  status: PlanoStatus
  vencimento: string
  gateway_id: string | null
  atualizado_em: string
}
export interface AceiteTermos {
  id: number
  usuario_id: string
  versao: string
  ip: string | null
  aceito_em: string
}
export interface Brinquedo {
  id: string
  locadora_id: string
  nome: string
  categoria: string | null
  quantidade: number
  valor_diaria: number
  dimensoes: string | null
  faixa_etaria: string | null
  capacidade: number | null
  energia: string | null
  regras: string | null
  fotos: string[]
  ativo: boolean
  criado_em: string
}
export interface Cliente {
  id: string
  locadora_id: string
  nome: string
  cpf: string
  rg: string | null
  telefone: string | null
  email: string | null
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  observacoes: string | null
  criado_em: string
}
export interface Locacao {
  id: string
  locadora_id: string
  numero: number
  cliente_id: string | null
  data_inicio: string
  data_fim: string
  hora_entrega: string | null
  hora_retirada: string | null
  endereco_evento: string
  resp_nome: string | null
  resp_cpf: string | null
  resp_telefone: string | null
  frete: number
  desconto: number
  caucao: number
  forma_pagamento: string | null
  condicoes: string | null
  status: LocacaoStatus
  origem: 'app' | 'link'
  codigo_publico: string | null
  observacoes: string | null
  criado_em: string
}
export interface LocacaoItem {
  id: string
  locacao_id: string
  brinquedo_id: string | null
  nome: string
  quantidade: number
  valor: number
}
export interface Vistoria {
  id: string
  locacao_id: string
  fase: VistoriaFase
  itens: string[]
  observacoes: string | null
  fotos: string[]
  usuario_id: string | null
  feita_em: string
}
export interface LancamentoCaixa {
  id: string
  locadora_id: string
  tipo: CaixaTipo
  valor: number
  data: string
  categoria: string
  forma: string | null
  descricao: string | null
  locacao_id: string | null
  criado_em: string
}

/** Locação com itens (e cliente, quando o papel pode ler clientes). */
export type LocacaoCompleta = Locacao & {
  locacao_itens: Pick<LocacaoItem, 'id' | 'brinquedo_id' | 'nome' | 'quantidade' | 'valor'>[]
  clientes?: Pick<Cliente, 'id' | 'nome' | 'cpf' | 'telefone'> | null
}
