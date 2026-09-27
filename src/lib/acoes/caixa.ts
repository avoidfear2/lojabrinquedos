'use server'

import { CAT_ENT, CAT_SAI, FORMAS } from '@/lib/dominio/constantes'
import { diaValido, numv } from '@/lib/dominio/formato'
import { numeroContrato } from '@/lib/dominio/locacao'
import type { Resultado } from '@/lib/erros'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { falha, ou, semPermissao, sucesso, txt } from './comum'

/**
 * Caixa: registro do que a locadora recebeu e gastou por conta própria.
 * O app não processa pagamentos; só anota.
 */
export async function salvarLancamento(fd: FormData): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.verCaixa(ctx.usuario.papel)) return semPermissao
  const id = txt(fd, 'id')
  const tipo = txt(fd, 'tipo') === 'saida' ? 'saida' : 'entrada'
  const valor = numv(txt(fd, 'valor'))
  const data = diaValido(txt(fd, 'data'))
  if (valor <= 0) return { ok: false, erro: 'Informe um valor maior que zero.' }
  if (!data) return { ok: false, erro: 'Informe a data.' }
  const cats = tipo === 'entrada' ? CAT_ENT : CAT_SAI
  const categoria = cats.includes(txt(fd, 'categoria')) ? txt(fd, 'categoria') : cats[cats.length - 1]
  let locacaoId = tipo === 'entrada' ? ou(txt(fd, 'locacao_id')) : null
  let descricao = ou(txt(fd, 'descricao'))

  // Pagamento de locação: descrição automática com o número do contrato
  if (locacaoId && !descricao) {
    const { data: l } = await ctx.supabase.from('locacoes').select('numero,data_inicio,resp_nome,clientes(nome)').eq('id', locacaoId).maybeSingle()
    if (!l) locacaoId = null
    else {
      const cli = (l.clientes as unknown as { nome: string } | null)?.nome ?? l.resp_nome ?? ''
      descricao = `Contrato ${numeroContrato(l.numero, l.data_inicio)}${cli ? ' – ' + cli : ''}`
    }
  }
  const forma = FORMAS.includes(txt(fd, 'forma')) ? txt(fd, 'forma') : null
  const c = { tipo, valor, data, categoria, forma, descricao, locacao_id: locacaoId }
  const { error } = id ? await ctx.supabase.from('caixa').update(c).eq('id', id) : await ctx.supabase.from('caixa').insert(c)
  if (error) return falha(ctx, error)
  return sucesso(undefined, locacaoId && !id ? 'Pagamento registrado' : 'Lançamento salvo')
}

export async function excluirLancamento(id: string): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.verCaixa(ctx.usuario.papel)) return semPermissao
  const { error } = await ctx.supabase.from('caixa').delete().eq('id', id)
  if (error) return falha(ctx, error)
  return sucesso(undefined, 'Lançamento excluído')
}
