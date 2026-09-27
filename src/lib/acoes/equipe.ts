'use server'

import type { Resultado } from '@/lib/erros'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Papel } from '@/lib/tipos'
import { falha, semPermissao, sucesso, txt } from './comum'

const PAPEIS_CONVITE: Papel[] = ['operador', 'entregador', 'dono']

/**
 * Convida alguém por e-mail. A service role só envia o convite (cria o login);
 * o vínculo com a locadora é gravado com a sessão do dono, sob a RLS
 * (política dono_gerencia em usuarios).
 */
export async function convidarMembro(fd: FormData): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.gerenciarEquipe(ctx.usuario.papel)) return semPermissao
  const nome = txt(fd, 'nome')
  const email = txt(fd, 'email').toLowerCase()
  const papel = txt(fd, 'papel') as Papel
  if (!nome) return { ok: false, erro: 'Informe o nome.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'Informe um e-mail válido.' }
  if (!PAPEIS_CONVITE.includes(papel)) return { ok: false, erro: 'Escolha o papel.' }
  if (!ctx.podeGravar) return falha(ctx, { code: '42501' })

  let admin
  try {
    admin = supabaseAdmin()
  } catch {
    return { ok: false, erro: 'Convites ainda não configurados neste servidor (falta a chave de serviço).' }
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/confirmar?next=/definir-senha`,
    data: { nome },
  })
  if (error || !data.user) {
    if (/already been registered|already registered|exists/i.test(error?.message ?? '')) {
      return { ok: false, erro: 'Este e-mail já tem conta no app. Por enquanto, convide um e-mail que ainda não tenha cadastro.' }
    }
    return falha(ctx, error)
  }

  const { error: e2 } = await ctx.supabase.from('usuarios').insert({ id: data.user.id, locadora_id: ctx.locadora.id, nome, papel })
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {})
    return falha(ctx, e2)
  }
  return sucesso(undefined, `Convite enviado para ${email}`)
}

export async function alterarMembro(id: string, mudanca: { papel?: Papel; ativo?: boolean }): Promise<Resultado> {
  const ctx = await contexto()
  if (!pode.gerenciarEquipe(ctx.usuario.papel)) return semPermissao
  if (id === ctx.uid) return { ok: false, erro: 'Você não pode alterar o próprio acesso.' }
  const upd: { papel?: Papel; ativo?: boolean } = {}
  if (mudanca.papel && PAPEIS_CONVITE.includes(mudanca.papel)) upd.papel = mudanca.papel
  if (typeof mudanca.ativo === 'boolean') upd.ativo = mudanca.ativo
  const { error, count } = await ctx.supabase.from('usuarios').update(upd, { count: 'exact' }).eq('id', id)
  if (error) return falha(ctx, error)
  if (!count) return { ok: false, erro: 'Membro não encontrado.' }
  return sucesso(undefined, upd.ativo === false ? 'Acesso desativado' : upd.ativo === true ? 'Acesso reativado' : 'Papel alterado')
}
