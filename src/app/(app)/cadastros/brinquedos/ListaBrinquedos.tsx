'use client'

import { useState } from 'react'
import { FormBrinquedo } from '@/components/forms/FormBrinquedo'
import { Folha } from '@/components/ui'
import { brl } from '@/lib/dominio/formato'
import type { Brinquedo, PlanoTipo } from '@/lib/tipos'

export function ListaBrinquedos({ brinquedos, abrirNovo, plano }: { brinquedos: Brinquedo[]; abrirNovo: boolean; plano: PlanoTipo }) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<Brinquedo | 'novo' | null>(abrirNovo ? 'novo' : null)
  const q = busca.toLowerCase()
  const lista = brinquedos
    .filter((b) => !q || (b.nome + ' ' + (b.categoria ?? '')).toLowerCase().includes(q))
    .sort((x, y) => Number(y.ativo) - Number(x.ativo) || x.nome.localeCompare(y.nome))
  return (
    <>
      <div className="sh">
        <h2 className="page-h">Brinquedos</h2>
        <button className="btn primary sm" onClick={() => setAberto('novo')}>Novo brinquedo</button>
      </div>
      {plano === 'essencial' && brinquedos.length >= 12 && (
        <p className="note">O plano Essencial permite até 15 brinquedos cadastrados ({brinquedos.length} de 15).</p>
      )}
      <input className="search" type="search" placeholder="Buscar brinquedo" aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {lista.length ? (
        lista.map((b) => (
          <button key={b.id} className="card" onClick={() => setAberto(b)}>
            <div className="row">
              <strong>{b.nome}</strong>
              <span>{brl(b.valor_diaria)}</span>
            </div>
            <small>
              {b.categoria ?? ''}
              {b.dimensoes ? ' – ' + b.dimensoes : ''}
            </small>
            <div className="row" style={{ marginTop: 4 }}>
              <small>
                {b.quantidade} unidade{b.quantidade > 1 ? 's' : ''}
                {b.faixa_etaria ? ' – ' + b.faixa_etaria : ''}
              </small>
              {!b.ativo && <span className="tag">Inativo</span>}
            </div>
          </button>
        ))
      ) : (
        <p className="empty">{busca ? 'Nenhum brinquedo encontrado.' : 'Nenhum brinquedo cadastrado ainda.'}</p>
      )}
      <Folha titulo={aberto === 'novo' ? 'Novo brinquedo' : 'Editar brinquedo'} aberta={aberto !== null} onFechar={() => setAberto(null)}>
        {aberto !== null && <FormBrinquedo key={aberto === 'novo' ? 'novo' : aberto.id} b={aberto === 'novo' ? null : aberto} onFim={() => setAberto(null)} />}
      </Folha>
    </>
  )
}
