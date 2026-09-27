import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { Usuario } from '@/lib/tipos'
import { TelaEquipe } from './TelaEquipe'

export const metadata: Metadata = { title: 'Equipe' }

export default async function Equipe() {
  const ctx = await contexto()
  if (!pode.gerenciarEquipe(ctx.usuario.papel)) redirect('/ajustes')
  const { data } = await ctx.supabase.from('usuarios').select('*').order('criado_em')
  return (
    <>
      <Link className="voltar" href="/ajustes">‹ Ajustes</Link>
      <TelaEquipe membros={(data ?? []) as Usuario[]} eu={ctx.uid} />
    </>
  )
}
