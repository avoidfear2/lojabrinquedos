'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Aba } from '@/lib/permissoes'
import { Icone } from './Icone'

export function Abas({ abas }: { abas: Aba[] }) {
  const path = usePathname()
  const ativa = (href: string) => {
    const raiz = '/' + href.split('/')[1]
    return path === href || path.startsWith(raiz + '/') || path === raiz
  }
  return (
    <nav className="tabs" aria-label="Seções" data-n={abas.length}>
      {abas.map((a) => (
        <Link key={a.href} href={a.href} aria-current={ativa(a.href) ? 'page' : undefined}>
          <Icone nome={a.icone} />
          {a.rotulo}
        </Link>
      ))}
    </nav>
  )
}
