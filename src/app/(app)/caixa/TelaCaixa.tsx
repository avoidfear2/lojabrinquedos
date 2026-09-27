'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BotaoConfirmar, Campo, Erro, Folha, Selecao } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { excluirLancamento, salvarLancamento } from '@/lib/acoes/caixa'
import { CAT_ENT, CAT_SAI, FORMAS } from '@/lib/dominio/constantes'
import { brl, cap, dow, fData, hoje, MESES, nfmt, somaMes } from '@/lib/dominio/formato'
import type { CaixaTipo, LancamentoCaixa } from '@/lib/tipos'

interface Props {
  mes: string
  tipo: 'todos' | CaixaTipo
  lancamentos: LancamentoCaixa[]
  locacoes: { id: string; rotulo: string }[]
  contratos: Record<string, string>
}

export function TelaCaixa({ mes, tipo, lancamentos, locacoes, contratos }: Props) {
  const [aberto, setAberto] = useState<LancamentoCaixa | CaixaTipo | null>(null)
  const [y, m] = mes.split('-').map(Number)
  const ent = lancamentos.filter((c) => c.tipo === 'entrada').reduce((s, c) => s + Number(c.valor), 0)
  const sai = lancamentos.filter((c) => c.tipo === 'saida').reduce((s, c) => s + Number(c.valor), 0)
  const lista = tipo === 'todos' ? lancamentos : lancamentos.filter((c) => c.tipo === tipo)

  const cats: Record<string, number> = {}
  lancamentos.filter((c) => c.tipo === 'saida').forEach((c) => (cats[c.categoria] = (cats[c.categoria] ?? 0) + Number(c.valor)))
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])

  function exportar() {
    const q = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
    const linhas = [...lancamentos]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((c) =>
        [fData(c.data), c.tipo === 'entrada' ? 'Entrada' : 'Saída', q(c.categoria), q(c.descricao), q(c.forma), c.locacao_id ? contratos[c.locacao_id] ?? '' : '', (c.tipo === 'saida' ? '-' : '') + nfmt(c.valor)].join(';'),
      )
    const txt = '﻿' + ['Data;Tipo;Categoria;Descrição;Forma;Contrato;Valor', ...linhas].join('\r\n')
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `caixa-${mes}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  let ultimo = ''
  const titulo = aberto === 'entrada' ? 'Nova entrada' : aberto === 'saida' ? 'Nova saída' : 'Editar lançamento'
  return (
    <>
      <div className="mnav">
        <Link className="x" href={`/caixa?mes=${somaMes(mes, -1)}&tipo=${tipo}`} aria-label="Mês anterior">‹</Link>
        <h2>{MESES[m - 1]} {y}</h2>
        <Link className="x" href={`/caixa?mes=${somaMes(mes, 1)}&tipo=${tipo}`} aria-label="Próximo mês">›</Link>
      </div>
      <div className="stats">
        <div className="stat in"><span>Entradas</span><b>{brl(ent)}</b></div>
        <div className="stat out"><span>Saídas</span><b>{brl(sai)}</b></div>
        <div className="stat"><span>Saldo</span><b>{brl(ent - sai)}</b></div>
      </div>
      <div className="two">
        <button className="btn green" onClick={() => setAberto('entrada')}>Lançar entrada</button>
        <button className="btn red" onClick={() => setAberto('saida')}>Lançar saída</button>
      </div>
      {top.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: '.95rem', marginBottom: 6 }}>Para onde foi o dinheiro</h3>
          {top.map(([k, v]) => (
            <div className="av" key={k}>
              <span>{k}</span>
              <span>{brl(v)}</span>
              <div className="bar"><i className="none" style={{ width: `${sai ? (v / sai) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      <div className="chips">
        {([['todos', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas']] as const).map(([k, t]) => (
          <Link key={k} className="chip" href={`/caixa?mes=${mes}&tipo=${k}`} aria-pressed={tipo === k}>{t}</Link>
        ))}
        {lancamentos.length > 0 && <button className="chip" onClick={exportar}>Exportar planilha (CSV)</button>}
      </div>
      {lista.length ? (
        lista.map((c) => {
          const grupo = c.data !== ultimo ? <p className="dgrp">{cap(dow(c.data))}, {fData(c.data)}</p> : null
          ultimo = c.data
          return (
            <div key={c.id}>
              {grupo}
              <button className="cx" onClick={() => setAberto(c)}>
                <strong>{c.descricao || c.categoria}</strong>
                <b className={c.tipo === 'entrada' ? 'in' : 'out'}>{c.tipo === 'entrada' ? '+' : '−'} {brl(c.valor)}</b>
                <small>
                  {c.categoria}
                  {c.forma ? ' – ' + c.forma : ''}
                  {c.locacao_id && contratos[c.locacao_id] ? ' – contrato ' + contratos[c.locacao_id] : ''}
                </small>
              </button>
            </div>
          )
        })
      ) : (
        <p className="empty">Nenhum lançamento neste mês.</p>
      )}
      <Folha titulo={titulo} aberta={aberto !== null} onFechar={() => setAberto(null)}>
        {aberto !== null && (
          <FormLancamento
            key={typeof aberto === 'string' ? aberto : aberto.id}
            c={typeof aberto === 'string' ? null : aberto}
            tipoInicial={typeof aberto === 'string' ? aberto : aberto.tipo}
            locacoes={locacoes}
            onFim={() => setAberto(null)}
          />
        )}
      </Folha>
    </>
  )
}

function FormLancamento({ c, tipoInicial, locacoes, onFim }: { c: LancamentoCaixa | null; tipoInicial: CaixaTipo; locacoes: { id: string; rotulo: string }[]; onFim: () => void }) {
  const { executar, erro, pendente } = useAcao()
  const [tipo, setTipo] = useState<CaixaTipo>(tipoInicial)
  const cats = tipo === 'entrada' ? CAT_ENT : CAT_SAI
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        executar(() => salvarLancamento(new FormData(e.currentTarget)), onFim)
      }}
    >
      <input type="hidden" name="id" value={c?.id ?? ''} />
      <div className="tipo" role="radiogroup" aria-label="Tipo">
        <label><input type="radio" name="tipo" value="entrada" checked={tipo === 'entrada'} onChange={() => setTipo('entrada')} />Entrada</label>
        <label><input type="radio" name="tipo" value="saida" checked={tipo === 'saida'} onChange={() => setTipo('saida')} />Saída</label>
      </div>
      <div className="g2">
        <Campo rotulo="Valor (R$)" name="valor" inputMode="decimal" placeholder="0,00" defaultValue={c ? nfmt(c.valor) : ''} obrigatorio />
        <Campo rotulo="Data" name="data" type="date" defaultValue={c?.data ?? hoje()} obrigatorio />
      </div>
      <div className="g2">
        <Selecao key={tipo} rotulo="Categoria" name="categoria" opcoes={cats} defaultValue={c && c.tipo === tipo ? c.categoria : cats[0]} />
        <Selecao rotulo="Forma" name="forma" opcoes={FORMAS} defaultValue={c?.forma ?? 'Pix'} />
      </div>
      <Campo rotulo="Descrição" name="descricao" defaultValue={c?.descricao} placeholder="Ex.: Gasolina da semana" />
      {tipo === 'entrada' && (
        <Selecao
          rotulo="Vincular a uma locação"
          name="locacao_id"
          vazio="Nenhuma"
          opcoes={[...(c?.locacao_id && !locacoes.some((l) => l.id === c.locacao_id) ? [[c.locacao_id, 'Locação vinculada'] as [string, string]] : []), ...locacoes.map((l) => [l.id, l.rotulo] as [string, string])]}
          defaultValue={c?.locacao_id ?? ''}
        />
      )}
      <Erro msg={erro} />
      <div className="acts">
        {c && (
          <BotaoConfirmar disabled={pendente} onConfirmar={() => executar(() => excluirLancamento(c.id), onFim)}>Excluir</BotaoConfirmar>
        )}
        <button className="btn primary" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar lançamento'}</button>
      </div>
    </form>
  )
}
