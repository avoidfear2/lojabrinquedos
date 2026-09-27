import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TERMOS_VERSAO } from '@/lib/dominio/constantes'
import { usuarioLogado } from '@/lib/sessao'
import { FormAceite } from './FormAceite'

export const metadata: Metadata = { title: 'Termos de Uso' }

export default async function Aceite() {
  const u = await usuarioLogado()
  if (!u) redirect('/entrar')
  const { data } = await u.supabase.from('usuarios').select('id').eq('id', u.uid).maybeSingle()
  if (!data) redirect('/cadastro')
  const { data: ja } = await u.supabase.from('aceites_termos').select('id').eq('usuario_id', u.uid).eq('versao', TERMOS_VERSAO).limit(1)
  if (ja?.length) redirect('/inicio')
  return (
    <>
      <h1>Termos de Uso</h1>
      <p className="lead">Antes de continuar, leia e aceite os Termos de Uso (versão {TERMOS_VERSAO}).</p>
      <FormAceite />
    </>
  )
}
