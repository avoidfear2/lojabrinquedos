import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

/**
 * Cliente sem sessão (papel anon) para o link público de reserva.
 * O anon não lê nenhuma tabela: só chama as funções reserva_* do banco.
 */
export function supabaseAnon() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}
