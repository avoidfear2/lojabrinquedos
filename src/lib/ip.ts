import 'server-only'

import { headers } from 'next/headers'

/** IP de quem fez a requisição (registrado junto com o aceite dos termos). */
export async function ipDaRequisicao(): Promise<string | null> {
  const h = await headers()
  const bruto = (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '').split(',')[0].trim()
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bruto)) return bruto
  if (/^[0-9a-fA-F:]+$/.test(bruto) && bruto.includes(':')) return bruto
  return null
}
