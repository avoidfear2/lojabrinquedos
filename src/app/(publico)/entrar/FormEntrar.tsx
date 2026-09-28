'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Campo, Erro } from '@/components/ui'
import { traduzErroAuth } from '@/lib/erros'
import { supabaseNavegador } from '@/lib/supabase/browser'

type Modo = 'entrar' | 'criar' | 'esqueci'

export function FormEntrar() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('entrar')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pendente, start] = useTransition()

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') ?? '').trim()
    const senha = String(fd.get('senha') ?? '')
    setErro('')
    setAviso('')
    start(async () => {
      try {
        await enviarAuth(email, senha, fd)
      } catch (err) {
        setErro(traduzErroAuth(err))
      }
    })
  }

  async function enviarAuth(email: string, senha: string, fd: FormData) {
    {
      const sb = supabaseNavegador()
      const volta = (next: string) => `${location.origin}/auth/confirmar?next=${encodeURIComponent(next)}`
      if (modo === 'entrar') {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha })
        if (error) return setErro(traduzErroAuth(error))
        router.replace('/inicio')
        router.refresh()
      } else if (modo === 'criar') {
        if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
        if (senha !== String(fd.get('senha2') ?? '')) return setErro('As senhas não conferem.')
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: volta('/cadastro') } })
        if (error) return setErro(traduzErroAuth(error))
        if (data.session) {
          router.replace('/cadastro')
          router.refresh()
        } else setAviso('Enviamos um link de confirmação para ' + email + '. Abra o e-mail para continuar o cadastro.')
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: volta('/definir-senha') })
        if (error) return setErro(traduzErroAuth(error))
        setAviso('Se este e-mail tiver conta, enviamos um link para criar uma nova senha.')
      }
    }
  }

  return (
    <form className="card" onSubmit={enviar} key={modo}>
      <div className="seg" role="tablist">
        <button type="button" aria-pressed={modo === 'entrar'} onClick={() => setModo('entrar')}>
          Entrar
        </button>
        <button type="button" aria-pressed={modo === 'criar'} onClick={() => setModo('criar')}>
          Criar conta
        </button>
      </div>
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" obrigatorio inputMode="email" />
      {modo !== 'esqueci' && (
        <Campo
          rotulo="Senha"
          name="senha"
          type="password"
          autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
          obrigatorio
          minLength={modo === 'criar' ? 8 : undefined}
        />
      )}
      {modo === 'criar' && <Campo rotulo="Repita a senha" name="senha2" type="password" autoComplete="new-password" obrigatorio minLength={8} />}
      {modo === 'criar' && (
        <p className="muted" style={{ fontSize: '.9rem', marginTop: 0 }}>
          Depois de criar a conta, você cadastra a locadora e aceita os <Link href="/termos" target="_blank">Termos de Uso</Link>.
        </p>
      )}
      <Erro msg={erro} />
      {aviso && <div className="ok-box">{aviso}</div>}
      <div className="acts">
        <button className="btn primary" disabled={pendente}>
          {pendente ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
        </button>
      </div>
      <p className="troca">
        {modo === 'esqueci' ? (
          <button type="button" className="lnk" onClick={() => setModo('entrar')}>
            Voltar para o login
          </button>
        ) : modo === 'entrar' ? (
          <button type="button" className="lnk" onClick={() => setModo('esqueci')}>
            Esqueci minha senha
          </button>
        ) : null}
      </p>
    </form>
  )
}
