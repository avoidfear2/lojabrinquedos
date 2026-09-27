import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseServidor } from '@/lib/supabase/server'

/**
 * Destino dos links de e-mail (confirmação de cadastro, convite de equipe,
 * troca de senha). Aceita os dois formatos do Supabase:
 *   ?code=...                      (fluxo PKCE, mesmo navegador)
 *   ?token_hash=...&type=invite    (modelo de e-mail recomendado; funciona em qualquer aparelho)
 *   #access_token=...              (modelo padrão do convite; repassado a /auth/concluir)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = seguro(searchParams.get('next'))
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const supabase = await supabaseServidor()

  // Sem code nem token_hash: a sessão veio no #fragmento (fluxo implícito).
  // O navegador mantém o fragmento no redirecionamento; /auth/concluir lê.
  if (!code && !tokenHash) return NextResponse.redirect(`${origin}/auth/concluir?next=${encodeURIComponent(next)}`)

  let ok = false
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error

  if (!ok) return NextResponse.redirect(`${origin}/entrar?erro=link`)
  const destino = type === 'invite' || type === 'recovery' ? '/definir-senha' : next
  return NextResponse.redirect(`${origin}${destino}`)
}

function seguro(p: string | null) {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/inicio'
}
