'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FormCliente } from '@/components/forms/FormCliente'
import { Folha } from '@/components/ui'
import { fCPF, fData, fTel, onlyDig } from '@/lib/dominio/formato'
import type { Cliente } from '@/lib/tipos'

export interface ResumoCliente {
  n: number
  ultima: string
}

export function ListaClientes({ clientes, resumo, abrirNovo }: { clientes: Cliente[]; resumo: Record<string, ResumoCliente>; abrirNovo: boolean }) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<Cliente | 'novo' | null>(abrirNovo ? 'novo' : null)
  const q = busca.toLowerCase()
  const qd = onlyDig(busca)
  const lista = clientes.filter(
    (c) =>
      !q ||
      (c.nome + ' ' + (c.bairro ?? '') + ' ' + (c.cidade ?? '')).toLowerCase().includes(q) ||
      (qd.length >= 3 && (c.cpf.includes(qd) || onlyDig(c.telefone).includes(qd))),
  )
  const r = aberto && aberto !== 'novo' ? resumo[aberto.id] : null
  return (
    <>
      <div className="sh">
        <h2 className="page-h">Clientes</h2>
        <button className="btn primary sm" onClick={() => setAberto('novo')}>Novo cliente</button>
      </div>
      <input className="search" type="search" placeholder="Buscar por nome, CPF, telefone ou bairro" aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {lista.length ? (
        lista.map((c) => {
          const n = resumo[c.id]?.n ?? 0
          return (
            <button key={c.id} className="card" onClick={() => setAberto(c)}>
              <div className="row">
                <strong>{c.nome}</strong>
                <span className="tag">{n} locaç{n === 1 ? 'ão' : 'ões'}</span>
              </div>
              <small>CPF {fCPF(c.cpf)}{c.telefone ? ' – ' + fTel(c.telefone) : ''}</small>
              <small>{[c.bairro, c.cidade].filter(Boolean).join(', ')}</small>
            </button>
          )
        })
      ) : (
        <p className="empty">{busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
      )}
      <Folha titulo={aberto === 'novo' ? 'Novo cliente' : 'Editar cliente'} aberta={aberto !== null} onFechar={() => setAberto(null)}>
        {r && aberto !== 'novo' && aberto && (
          <div className="note">
            {r.n} locaç{r.n === 1 ? 'ão' : 'ões'}
            {r.ultima ? ` – última em ${fData(r.ultima)}` : ''} ·{' '}
            <Link href={`/locacoes/nova?cliente=${aberto.id}`}>Nova locação para este cliente</Link>
          </div>
        )}
        {aberto !== null && (
          <FormCliente key={aberto === 'novo' ? 'novo' : aberto.id} c={aberto === 'novo' ? null : aberto} onFim={() => setAberto(null)} />
        )}
      </Folha>
    </>
  )
}
