import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from '@/lib/supabase/env'

const PUBLICAS = ['/entrar', '/termos', '/auth', '/offline']

/** Renova a sessão do Supabase a cada navegação e manda quem não entrou para /entrar. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!supabaseConfigurado()) return response

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const logado = Boolean(data?.claims?.sub)
  const path = request.nextUrl.pathname
  const publica = path === '/' || PUBLICAS.some((p) => path === p || path.startsWith(p + '/'))

  if (!logado && !publica) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons/|sw.js|manifest.webmanifest|icon.png|favicon.ico|offline.html).*)'],
}
