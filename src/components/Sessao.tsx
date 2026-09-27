'use client'

import { createContext, useContext } from 'react'
import type { Papel } from '@/lib/tipos'

export interface SessaoCliente {
  papel: Papel
  podeGravar: boolean
  uid: string
}

const Ctx = createContext<SessaoCliente>({ papel: 'entregador', podeGravar: false, uid: '' })
export const useSessao = () => useContext(Ctx)

export function SessaoProvider({ valor, children }: { valor: SessaoCliente; children: React.ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
