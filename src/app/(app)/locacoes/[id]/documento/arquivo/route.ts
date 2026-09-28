import { type NextRequest } from 'next/server'
import { faltandoNoLocador, paginaDocumento } from '@/lib/documentos/modelo'
import { estadoDocumento } from '@/lib/documentos/servidor'
import { numeroContrato } from '@/lib/dominio/locacao'
import { contexto } from '@/lib/sessao'

/**
 * O documento como página própria: pré-visualização (em iframe) e versão para
 * imprimir ou salvar em PDF. O HTML vem do banco, então a página bloqueia
 * qualquer script (CSP) e só aceita imagens embutidas (as assinaturas).
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contexto()
  const e = await estadoDocumento(ctx, id)

  let html: string
  let assinaturas = e.assinaturas
  let aviso: string | undefined
  if (e.desatualizado && e.atual) {
    html = e.atual.html
    assinaturas = []
    aviso = e.gravado
      ? 'A locação mudou depois da última versão. Esta é a versão atual, ainda sem assinaturas.'
      : 'Prévia do contrato, ainda sem assinaturas.'
  } else if (e.gravado) {
    html = e.gravado.conteudo_html
  } else {
    return new Response('Contrato ainda não gerado.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  const falta = e.dados ? faltandoNoLocador(e.dados.locadora) : []
  if (falta.length) aviso = `Complete em Ajustes: ${falta.join(', ')}. ` + (aviso ?? '')

  const num = e.dados ? numeroContrato(e.dados.locacao.numero, e.dados.locacao.data_inicio) : ''
  const pagina = paginaDocumento(html, assinaturas, num ? `Contrato ${num}` : 'Contrato', aviso)
  return new Response(pagina, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
