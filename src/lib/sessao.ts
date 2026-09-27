import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { supabaseServidor } from './supabase/server'
import { TERMOS_VERSAO } from './dominio/constantes'
import type { AssinaturaPlano, Locadora, Usuario } from './tipos'

/** Usuário logado (ou null), sem exigir locadora. */
export const usuarioLogado = cache(async () => {
  const supabase = await supabaseServidor()
  const { data } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  return sub ? { supabase, uid: sub as string, email: (data?.claims?.email as string | undefined) ?? '' } : null
})

export interface Contexto {
  supabase: Awaited<ReturnType<typeof supabaseServidor>>
  uid: string
  email: string
  usuario: Usuario
  locadora: Locadora
  plano: AssinaturaPlano | null
  podeGravar: boolean
}

/**
 * Contexto das telas internas. Redireciona para /entrar (sem sessão),
 * /cadastro (sem locadora) ou /aceite (termos da versão atual não aceitos).
 */
export const contexto = cache(async (): Promise<Contexto> => {
  const u = await usuarioLogado()
  if (!u) redirect('/entrar')
  const { supabase, uid, email } = u

  const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', uid).maybeSingle<Usuario>()
  if (!usuario) redirect('/cadastro')

  const [loc, plano, grava, aceite] = await Promise.all([
    supabase.from('locadoras').select('*').eq('id', usuario.locadora_id).single<Locadora>(),
    supabase.from('assinaturas_plano').select('*').eq('locadora_id', usuario.locadora_id).maybeSingle<AssinaturaPlano>(),
    supabase.rpc('pode_gravar'),
    supabase.from('aceites_termos').select('id').eq('usuario_id', uid).eq('versao', TERMOS_VERSAO).limit(1),
  ])
  if (!loc.data) redirect('/cadastro')
  if (!aceite.data?.length) redirect('/aceite')

  return {
    supabase,
    uid,
    email,
    usuario,
    locadora: loc.data,
    plano: plano.data ?? null,
    podeGravar: grava.data === true,
  }
})
