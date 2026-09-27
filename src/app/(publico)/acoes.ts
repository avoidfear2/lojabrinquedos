'use server'

import { redirect } from 'next/navigation'
import { TERMOS_VERSAO } from '@/lib/dominio/constantes'
import { docOk, onlyDig } from '@/lib/dominio/formato'
import { traduzErro, type Resultado } from '@/lib/erros'
import { ipDaRequisicao } from '@/lib/ip'
import { usuarioLogado } from '@/lib/sessao'

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

/** Cadastro da locadora: cria locadora, usuário dono, plano de teste e aceite dos termos (função criar_locadora). */
export async function criarLocadora(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const u = await usuarioLogado()
  if (!u) redirect('/entrar')

  const nome = txt(fd, 'nome')
  const doc = onlyDig(txt(fd, 'doc'))
  const nomeUsuario = txt(fd, 'nome_usuario')
  if (!nome) return { ok: false, erro: 'Informe o nome da locadora.' }
  if (!(doc.length === 11 || doc.length === 14) || !docOk(doc)) return { ok: false, erro: 'Informe um CPF ou CNPJ válido.' }
  if (!nomeUsuario) return { ok: false, erro: 'Informe seu nome.' }
  if (fd.get('aceite') !== 'on') return { ok: false, erro: 'Para continuar, aceite os Termos de Uso.' }

  const { error } = await u.supabase.rpc('criar_locadora', {
    p_nome: nome,
    p_cpf_cnpj: doc,
    p_nome_usuario: nomeUsuario,
    p_versao_termos: TERMOS_VERSAO,
    p_ip: await ipDaRequisicao(),
  })
  if (error) {
    if (/já pertence/.test(error.message)) {
      return { ok: false, erro: 'Este usuário já faz parte de uma locadora, mas o acesso está desativado. Fale com o dono da locadora.' }
    }
    return { ok: false, erro: traduzErro(error) }
  }
  redirect('/inicio')
}

/** Aceite da versão atual dos termos (membros convidados e novas versões). */
export async function aceitarTermos(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const u = await usuarioLogado()
  if (!u) redirect('/entrar')
  if (fd.get('aceite') !== 'on') return { ok: false, erro: 'Para continuar, aceite os Termos de Uso.' }
  const { error } = await u.supabase
    .from('aceites_termos')
    .insert({ usuario_id: u.uid, versao: TERMOS_VERSAO, ip: await ipDaRequisicao() })
  if (error) return { ok: false, erro: traduzErro(error) }
  redirect('/inicio')
}
