'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Campo, Erro } from '@/components/ui'
import { criarLocadora } from '../acoes'

export function FormCadastro({ email }: { email: string }) {
  const [estado, acao, pendente] = useActionState(criarLocadora, null)
  return (
    <form className="card" action={acao}>
      <Campo rotulo="Nome da locadora (ou razão social)" name="nome" obrigatorio autoComplete="organization" placeholder="Ex.: Pula Alegria Festas" />
      <Campo rotulo="CPF ou CNPJ" name="doc" mascara="doc" inputMode="numeric" obrigatorio />
      <Campo rotulo="Seu nome" name="nome_usuario" obrigatorio autoComplete="name" />
      <p className="muted" style={{ fontSize: '.9rem', marginTop: 0 }}>
        Você entra como <b>dono</b> da conta, com o e-mail {email}. Depois pode convidar operadores e entregadores.
      </p>
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
          {pendente ? 'Criando…' : 'Criar minha locadora'}
        </button>
      </div>
    </form>
  )
}
