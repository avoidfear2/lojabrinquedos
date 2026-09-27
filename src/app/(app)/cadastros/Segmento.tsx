'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Segmento() {
  const p = usePathname()
  return (
    <div className="seg">
      <Link href="/cadastros/brinquedos" aria-pressed={p.startsWith('/cadastros/brinquedos')}>Brinquedos</Link>
      <Link href="/cadastros/clientes" aria-pressed={p.startsWith('/cadastros/clientes')}>Clientes</Link>
    </div>
  )
}
