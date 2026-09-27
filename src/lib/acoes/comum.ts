import 'server-only'

import { revalidatePath } from 'next/cache'
import { traduzErro, type Resultado } from '@/lib/erros'
import type { Contexto } from '@/lib/sessao'

export const txt = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
export const ou = (s: string) => (s === '' ? null : s)

export function falha(ctx: Contexto, e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: traduzErro(e, ctx.podeGravar) }
}

export function sucesso<T>(dados?: T, msg?: string): Resultado<T> {
  revalidatePath('/', 'layout')
  return { ok: true, dados, msg }
}

export const semPermissao = { ok: false as const, erro: 'Você não tem permissão para esta ação.' }
