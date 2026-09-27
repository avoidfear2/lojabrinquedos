'use client'

import { useEffect } from 'react'
import { supabaseNavegador } from '@/lib/supabase/browser'

/**
 * Links de e-mail no formato padrão do Supabase (convite, por exemplo) trazem a
 * sessão no #fragmento da URL, que o servidor não enxerga. Esta página lê o
 * fragmento no navegador, grava a sessão e segue para o destino.
 */
export default function Concluir() {
  useEffect(() => {
    const h = new URLSearchParams(location.hash.slice(1))
    const q = new URLSearchParams(location.search)
    const next = q.get('next')?.startsWith('/') && !q.get('next')?.startsWith('//') ? q.get('next')! : '/inicio'
    const access_token = h.get('access_token')
    const refresh_token = h.get('refresh_token')
    const tipo = h.get('type')
    if (!access_token || !refresh_token) {
      location.replace('/entrar?erro=link')
      return
    }
    ;(async () => {
      const { error } = await supabaseNavegador().auth.setSession({ access_token, refresh_token })
      if (error) return location.replace('/entrar?erro=link')
      location.replace(tipo === 'invite' || tipo === 'recovery' ? '/definir-senha' : next)
    })()
  }, [])
  return (
    <main style={{ paddingTop: 60, textAlign: 'center' }}>
      <p className="muted">Entrando…</p>
    </main>
  )
}
