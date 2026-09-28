import 'server-only'

import { createHash } from 'node:crypto'
import { hoje } from '@/lib/dominio/formato'
import { pode } from '@/lib/permissoes'
import type { Contexto } from '@/lib/sessao'
import type { Brinquedo, Cliente, Locacao, LocacaoItem } from '@/lib/tipos'
import { gerarDocumento, partesDoDocumento, partesGravadas, VERSAO_MODELO, type DadosDocumento, type Partes, type PapelAssinatura } from './modelo'

export interface DocumentoGravado {
  id: string
  locacao_id: string
  versao_modelo: string
  conteudo_html: string
  hash_sha256: string
  criado_em: string
}
export interface AssinaturaGravada {
  id: string
  documento_id: string
  papel: PapelAssinatura
  imagem_png: string
  nome: string
  cpf: string | null
  hash_documento: string
  assinado_em: string
}

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

/** Data (em Brasília) em que um documento foi gerado. */
const diaDe = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

/** Dados para montar o contrato. Só dono e operador (o entregador não lê clientes). */
export async function carregarDados(ctx: Contexto, locacaoId: string): Promise<DadosDocumento | null> {
  const { data: l } = await ctx.supabase.from('locacoes').select('*, locacao_itens(brinquedo_id,nome,quantidade,valor)').eq('id', locacaoId).maybeSingle()
  if (!l) return null
  const loc = l as Locacao & { locacao_itens: DadosDocumento['itens'] }
  if (!loc.cliente_id) return null
  const ids = loc.locacao_itens.map((i) => i.brinquedo_id).filter((x): x is string => !!x)
  const [{ data: cli }, { data: bs }] = await Promise.all([
    ctx.supabase.from('clientes').select('*').eq('id', loc.cliente_id).maybeSingle<Cliente>(),
    ids.length ? ctx.supabase.from('brinquedos').select('id,dimensoes,faixa_etaria,capacidade,energia,regras').in('id', ids) : Promise.resolve({ data: [] }),
  ])
  if (!cli) return null
  return {
    locadora: ctx.locadora,
    cliente: cli,
    locacao: loc,
    itens: loc.locacao_itens as Pick<LocacaoItem, 'brinquedo_id' | 'nome' | 'quantidade' | 'valor'>[],
    brinquedos: (bs ?? []) as Pick<Brinquedo, 'id' | 'dimensoes' | 'faixa_etaria' | 'capacidade' | 'energia' | 'regras'>[],
  }
}

export interface EstadoDocumento {
  /** Última versão gravada (a que vale para assinatura). */
  gravado: DocumentoGravado | null
  assinaturas: AssinaturaGravada[]
  /** Texto atual, quando quem vê pode gerar (dono/operador). */
  atual: { html: string; hash: string } | null
  /** A locação mudou desde a última versão gravada (ou ainda não há versão). */
  desatualizado: boolean
  dados: DadosDocumento | null
  partes: Partes
}

export async function estadoDocumento(ctx: Contexto, locacaoId: string): Promise<EstadoDocumento> {
  const { data: docs } = await ctx.supabase
    .from('documentos')
    .select('*')
    .eq('locacao_id', locacaoId)
    .order('criado_em', { ascending: false })
    .limit(1)
  const gravado = ((docs ?? [])[0] ?? null) as DocumentoGravado | null
  const { data: ass } = gravado
    ? await ctx.supabase.from('assinaturas_doc').select('id,documento_id,papel,imagem_png,nome,cpf,hash_documento,assinado_em').eq('documento_id', gravado.id).order('assinado_em')
    : { data: [] }

  let atual: EstadoDocumento['atual'] = null
  let dados: DadosDocumento | null = null
  if (pode.editarLocacoes(ctx.usuario.papel)) {
    dados = await carregarDados(ctx, locacaoId)
    if (dados) {
      // Mesma data da versão gravada: se nada mudou, o hash bate e não se cria versão nova
      let html = gravado ? gerarDocumento(dados, diaDe(gravado.criado_em)) : ''
      if (!gravado || sha256(html) !== gravado.hash_sha256) html = gerarDocumento(dados, hoje())
      atual = { html, hash: sha256(html) }
    }
  }
  const desatualizado = !!atual && (!gravado || atual.hash !== gravado.hash_sha256)
  const partes = dados ? partesDoDocumento(dados) : gravado ? partesGravadas(gravado.conteudo_html) : {}
  return { gravado, assinaturas: (ass ?? []) as AssinaturaGravada[], atual, desatualizado, dados, partes }
}

/**
 * Garante uma versão gravada igual à locação atual e devolve o id dela.
 * Documento assinado nunca muda: se a locação mudou, grava uma versão nova.
 */
export async function garantirDocumento(ctx: Contexto, locacaoId: string): Promise<{ id: string } | { erro: string }> {
  const e = await estadoDocumento(ctx, locacaoId)
  if (!e.desatualizado) {
    return e.gravado ? { id: e.gravado.id } : { erro: 'O contrato ainda não foi gerado. Peça ao escritório para abrir o contrato desta locação.' }
  }
  if (!e.atual) return { erro: 'Não foi possível montar o contrato: confira o cliente da locação.' }
  const { data, error } = await ctx.supabase
    .from('documentos')
    .insert({ locacao_id: locacaoId, versao_modelo: VERSAO_MODELO, conteudo_html: e.atual.html })
    .select('id')
    .single()
  if (error || !data) return { erro: error?.message ?? 'Não foi possível gravar o contrato.' }
  return { id: data.id as string }
}
