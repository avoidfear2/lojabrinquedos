import { redirect } from 'next/navigation'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { Segmento } from './Segmento'

export default async function LayoutCadastros({ children }: { children: React.ReactNode }) {
  const ctx = await contexto()
  if (!pode.editarCadastros(ctx.usuario.papel)) redirect('/inicio')
  return (
    <>
      <Segmento />
      {children}
    </>
  )
}
