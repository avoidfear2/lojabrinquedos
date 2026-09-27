'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { Resultado } from '@/lib/erros'
import { useToast } from './ui'

/** Chama uma Server Action, mostra o erro ou o aviso de sucesso e atualiza a tela. */
export function useAcao() {
  const router = useRouter()
  const toast = useToast()
  const [erro, setErro] = useState('')
  const [pendente, start] = useTransition()

  function executar<T>(fn: () => Promise<Resultado<T>>, depois?: (dados: T | undefined) => void) {
    setErro('')
    start(async () => {
      try {
        const r = await fn()
        if (!r.ok) {
          setErro(r.erro)
          return
        }
        if (r.msg) toast(r.msg)
        router.refresh()
        depois?.(r.dados)
      } catch {
        setErro('Não foi possível salvar. Verifique a conexão e tente de novo.')
      }
    })
  }
  return { executar, erro, setErro, pendente }
}
