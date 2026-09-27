'use server'

import { CATS_B, ENERGIA } from '@/lib/dominio/constantes'
import { numv } from '@/lib/dominio/formato'
import type { Resultado } from '@/lib/erros'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { falha, ou, semPermissao, sucesso, txt } from './comum'

export async function salvarBrinquedo(fd: FormData): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarCadastros(ctx.usuario.papel)) return semPermissao
  const id = txt(fd, 'id')
  const nome = txt(fd, 'nome')
  const valor = numv(txt(fd, 'valor'))
  if (!nome) return { ok: false, erro: 'Informe o nome do brinquedo.' }
  if (valor <= 0) return { ok: false, erro: 'Informe o valor da diária.' }
  const cap = parseInt(txt(fd, 'capacidade'))
  const categoria = txt(fd, 'categoria')
  const energia = txt(fd, 'energia')
  const b = {
    nome,
    categoria: CATS_B.includes(categoria) ? categoria : 'Outro',
    quantidade: Math.max(1, parseInt(txt(fd, 'quantidade')) || 1),
    valor_diaria: valor,
    dimensoes: ou(txt(fd, 'dimensoes')),
    faixa_etaria: ou(txt(fd, 'faixa_etaria')),
    capacidade: Number.isFinite(cap) && cap >= 0 ? cap : null,
    energia: ENERGIA.includes(energia) ? energia : null,
    regras: ou(txt(fd, 'regras')),
    ativo: fd.get('ativo') === 'on',
  }
  const { error } = id ? await ctx.supabase.from('brinquedos').update(b).eq('id', id) : await ctx.supabase.from('brinquedos').insert(b)
  if (error) return falha(ctx, error)
  return sucesso(undefined, id ? 'Brinquedo atualizado' : 'Brinquedo cadastrado')
}

/**
 * Excluir: se o brinquedo já aparece em locações, só desativa (mantém o
 * histórico e o nome nos contratos); senão apaga de verdade.
 */
export async function excluirBrinquedo(id: string): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarCadastros(ctx.usuario.papel)) return semPermissao
  const { count } = await ctx.supabase.from('locacao_itens').select('id', { count: 'exact', head: true }).eq('brinquedo_id', id)
  if (count) {
    const { error } = await ctx.supabase.from('brinquedos').update({ ativo: false }).eq('id', id)
    if (error) return falha(ctx, error)
    return sucesso(undefined, 'Este brinquedo tem locações: ele foi desativado para manter o histórico.')
  }
  const { error } = await ctx.supabase.from('brinquedos').delete().eq('id', id)
  if (error) return falha(ctx, error)
  return sucesso(undefined, 'Brinquedo excluído')
}
