'use server'

import { headers } from 'next/headers'
import { faltandoNoLocador, type PapelAssinatura } from '@/lib/documentos/modelo'
import { estadoDocumento, garantirDocumento } from '@/lib/documentos/servidor'
import type { Resultado } from '@/lib/erros'
import { ipDaRequisicao } from '@/lib/ip'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { falha, semPermissao, sucesso } from './comum'

const PAPEIS: PapelAssinatura[] = ['locatario', 'responsavel', 'locador']
const ROTULO: Record<PapelAssinatura, string> = { locatario: 'locatário', responsavel: 'responsável', locador: 'locador' }

/**
 * Colhe uma assinatura na tela. Dono e operador assinam sempre a versão
 * atual (gerada agora se a locação mudou); o entregador assina a última
 * versão gravada pelo escritório. O banco grava o hash do documento na hora.
 */
export async function assinarDocumento(locacaoId: string, papel: PapelAssinatura, imagemPng: string): Promise<Resultado> {
  const ctx = await contexto()
  if (!PAPEIS.includes(papel)) return { ok: false, erro: 'Assinatura inválida.' }
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imagemPng) || imagemPng.length > 400_000) {
    return { ok: false, erro: 'Não foi possível ler a assinatura. Limpe o quadro e assine de novo.' }
  }
  const escritorio = pode.editarLocacoes(ctx.usuario.papel)
  if (papel === 'locador' && !escritorio) return semPermissao

  let documentoId: string
  if (escritorio) {
    const falta = faltandoNoLocador(ctx.locadora)
    if (falta.length) return { ok: false, erro: `Antes de colher assinaturas, preencha em Ajustes: ${falta.join(', ')}.` }
    const r = await garantirDocumento(ctx, locacaoId)
    if ('erro' in r) return { ok: false, erro: r.erro }
    documentoId = r.id
  } else {
    const e = await estadoDocumento(ctx, locacaoId)
    if (!e.gravado) return { ok: false, erro: 'O contrato ainda não foi gerado. Peça ao escritório para abrir o contrato desta locação.' }
    documentoId = e.gravado.id
  }

  const e = await estadoDocumento(ctx, locacaoId)
  if (e.gravado?.id !== documentoId) return { ok: false, erro: 'O contrato mudou agora há pouco. Abra de novo e assine.' }
  const parte = e.partes[papel]
  if (!parte) return { ok: false, erro: `Este contrato não tem assinatura de ${ROTULO[papel]}.` }
  if (e.assinaturas.some((a) => a.papel === papel)) return { ok: false, erro: `O ${ROTULO[papel]} já assinou esta versão.` }

  const h = await headers()
  const { error } = await ctx.supabase.from('assinaturas_doc').insert({
    documento_id: documentoId,
    papel,
    imagem_png: imagemPng,
    nome: parte.nome,
    cpf: parte.cpf || null,
    ip: await ipDaRequisicao(),
    aparelho: (h.get('user-agent') ?? '').slice(0, 300) || null,
  })
  if (error) return falha(ctx, error)
  return sucesso(undefined, `Assinatura do ${ROTULO[papel]} salva`)
}
