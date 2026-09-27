import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from './env'

/**
 * Cliente com a service role: ignora a RLS. Usado só para enviar convites
 * de equipe (auth.admin). Nunca importe em componente de cliente.
 */
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.')
  return createClient(SUPABASE_URL, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}
