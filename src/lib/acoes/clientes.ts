'use server'

import { UFS } from '@/lib/dominio/constantes'
import { cpfOk, onlyDig } from '@/lib/dominio/formato'
import type { Resultado } from '@/lib/erros'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { Cliente } from '@/lib/tipos'
import { falha, ou, semPermissao, sucesso, txt } from './comum'

export async function salvarCliente(fd: FormData): Promise<Resultado<Cliente>> {
  const ctx = await contexto()
  if (!pode.editarCadastros(ctx.usuario.papel)) return semPermissao
  const id = txt(fd, 'id')
  const cpf = onlyDig(txt(fd, 'cpf'))
  const faltando = [
    ['nome', 'Nome completo'],
    ['telefone', 'Telefone'],
    ['rua', 'Rua'],
    ['numero', 'Número'],
    ['bairro', 'Bairro'],
    ['cidade', 'Cidade'],
  ].filter(([k]) => !txt(fd, k))
  if (faltando.length) return { ok: false, erro: 'Preencha: ' + faltando.map(([, r]) => r).join(', ') + '.' }
  if (!cpfOk(cpf)) return { ok: false, erro: 'CPF inválido. Confira os números.' }

  const { data: dup } = await ctx.supabase.from('clientes').select('id,nome').eq('cpf', cpf).neq('id', id || '00000000-0000-0000-0000-000000000000').maybeSingle()
  if (dup) return { ok: false, erro: `Já existe um cliente com este CPF: ${dup.nome}` }

  const uf = txt(fd, 'uf').toUpperCase()
  const c = {
    nome: txt(fd, 'nome'),
    cpf,
    rg: ou(txt(fd, 'rg')),
    telefone: ou(txt(fd, 'telefone')),
    email: ou(txt(fd, 'email')),
    cep: ou(txt(fd, 'cep')),
    rua: ou(txt(fd, 'rua')),
    numero: ou(txt(fd, 'numero')),
    complemento: ou(txt(fd, 'complemento')),
    bairro: ou(txt(fd, 'bairro')),
    cidade: ou(txt(fd, 'cidade')),
    uf: UFS.includes(uf) ? uf : null,
    observacoes: ou(txt(fd, 'observacoes')),
  }
  const r = id
    ? await ctx.supabase.from('clientes').update(c).eq('id', id).select('*').single<Cliente>()
    : await ctx.supabase.from('clientes').insert(c).select('*').single<Cliente>()
  if (r.error) return falha(ctx, r.error)
  return sucesso(r.data, id ? 'Cliente atualizado' : 'Cliente cadastrado')
}

export async function excluirCliente(id: string): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarCadastros(ctx.usuario.papel)) return semPermissao
  const { count } = await ctx.supabase.from('locacoes').select('id', { count: 'exact', head: true }).eq('cliente_id', id)
  if (count) return { ok: false, erro: 'Este cliente tem locações. Exclua-as antes de remover o cadastro.' }
  const { error } = await ctx.supabase.from('clientes').delete().eq('id', id)
  if (error) return falha(ctx, error)
  return sucesso(undefined, 'Cliente excluído')
}
