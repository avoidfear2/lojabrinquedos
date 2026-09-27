'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

let cliente: ReturnType<typeof createBrowserClient> | null = null

/** Cliente do navegador: leituras interativas (disponibilidade no formulário) e login. */
export function supabaseNavegador() {
  cliente ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cliente
}
