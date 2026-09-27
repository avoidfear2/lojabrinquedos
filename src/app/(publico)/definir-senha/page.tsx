'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Campo, Erro } from '@/components/ui'
import { traduzErro } from '@/lib/erros'
import { supabaseNavegador } from '@/lib/supabase/browser'

export default function DefinirSenha() {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [pendente, start] = useTransition()
  return (
    <>
      <h1>Crie sua senha</h1>
      <p className="lead">Você vai usar este e-mail e esta senha para entrar no app.</p>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const s = String(fd.get('senha') ?? '')
          if (s.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
          if (s !== String(fd.get('senha2') ?? '')) return setErro('As senhas não conferem.')
          start(async () => {
            const { error } = await supabaseNavegador().auth.updateUser({ password: s })
            if (error) return setErro(traduzErro(error))
            router.replace('/inicio')
            router.refresh()
          })
        }}
      >
        <Campo rotulo="Nova senha" name="senha" type="password" autoComplete="new-password" obrigatorio minLength={8} />
        <Campo rotulo="Repita a senha" name="senha2" type="password" autoComplete="new-password" obrigatorio minLength={8} />
        <Erro msg={erro} />
        <div className="acts">
          <button className="btn primary" disabled={pendente}>
            {pendente ? 'Salvando…' : 'Salvar senha'}
          </button>
        </div>
      </form>
    </>
  )
}
