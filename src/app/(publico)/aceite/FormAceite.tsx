'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Erro } from '@/components/ui'
import { aceitarTermos } from '../acoes'

export function FormAceite() {
  const [estado, acao, pendente] = useActionState(aceitarTermos, null)
  return (
    <form className="card" action={acao}>
      <label className="check">
        <input type="checkbox" name="aceite" required />
        <span>
          Li e aceito os{' '}
          <Link href="/termos" target="_blank">
            Termos de Uso
          </Link>
          .
        </span>
      </label>
      <Erro msg={estado && !estado.ok ? estado.erro : ''} />
      <div className="acts">
        <button className="btn primary" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </form>
  )
}
