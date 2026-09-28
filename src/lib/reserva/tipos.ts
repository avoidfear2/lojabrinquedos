export interface CatalogoLink {
  locador: { nome: string; cpf_cnpj: string; telefone: string | null; cidade: string | null }
  aviso: string
  brinquedos: {
    id: string
    nome: string
    categoria: string | null
    valor: number
    dimensoes: string | null
    faixa_etaria: string | null
    fotos: string[]
  }[]
}

export interface PedidoLink {
  data_inicio: string
  data_fim: string
  hora_entrega: string
  nome: string
  cpf: string
  telefone: string
  email: string
  endereco_evento: string
  observacoes: string
  itens: { id: string; quantidade: number }[]
}

export interface ConsultaPedido {
  numero: number
  status: 'orcamento' | 'confirmada' | 'entregue' | 'concluida' | 'cancelada'
  data_inicio: string
  data_fim: string
  locador: string
  telefone_locador: string | null
  itens: { nome: string; quantidade: number }[] | null
}

/** Slug do link: letras minúsculas, números e hífen (mesma regra do banco). */
export const slugValido = (s: string) => /^[a-z0-9-]{3,40}$/.test(s)

export function sugerirSlug(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
