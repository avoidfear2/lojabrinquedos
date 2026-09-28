'use server'

import { docOk, numv, onlyDig } from '@/lib/dominio/formato'
import type { Resultado } from '@/lib/erros'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { slugValido } from '@/lib/reserva/tipos'
import { falha, ou, semPermissao, sucesso, txt } from './comum'

/** Dados da locadora (entram no contrato da Fase 2) e condições padrão. Só o dono altera. */
export async function salvarAjustes(fd: FormData): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarLocadora(ctx.usuario.papel)) return semPermissao
  const nome = txt(fd, 'nome')
  const doc = onlyDig(txt(fd, 'cpf_cnpj'))
  if (!nome) return { ok: false, erro: 'Informe o nome ou razão social.' }
  if (!(doc.length === 11 || doc.length === 14) || !docOk(doc)) return { ok: false, erro: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' }
  const l = {
    nome,
    cpf_cnpj: doc,
    telefone: ou(txt(fd, 'telefone')),
    endereco: ou(txt(fd, 'endereco')),
    cidade: ou(txt(fd, 'cidade')),
    comarca_foro: ou(txt(fd, 'comarca_foro')),
    chave_pix: ou(txt(fd, 'chave_pix')),
    canc_dias: Math.max(0, parseInt(txt(fd, 'canc_dias')) || 0),
    canc_pct: Math.min(100, Math.max(0, parseInt(txt(fd, 'canc_pct')) || 0)),
    taxa_visita: Math.max(0, numv(txt(fd, 'taxa_visita'))),
    clausulas_extras: ou(txt(fd, 'clausulas_extras')),
  }
  const { error, count } = await ctx.supabase.from('locadoras').update(l, { count: 'exact' }).eq('id', ctx.locadora.id)
  if (error) return falha(ctx, error)
  if (!count) return falha(ctx, { code: '42501' })
  return sucesso(undefined, 'Ajustes salvos')
}

/** Endereço do link público de reserva (/r/<endereço>). Vazio desliga o link. */
export async function salvarLink(fd: FormData): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.editarLocadora(ctx.usuario.papel)) return semPermissao
  const slug = txt(fd, 'slug').toLowerCase()
  if (slug && !slugValido(slug)) {
    return { ok: false, erro: 'Use de 3 a 40 caracteres: letras minúsculas sem acento, números e hífen. Ex.: pula-alegria' }
  }
  const { error, count } = await ctx.supabase.from('locadoras').update({ slug: slug || null }, { count: 'exact' }).eq('id', ctx.locadora.id)
  if (error) return falha(ctx, error)
  if (!count) return falha(ctx, { code: '42501' })
  return sucesso(undefined, slug ? 'Link de reserva salvo' : 'Link de reserva desligado')
}
