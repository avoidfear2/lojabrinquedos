import Link from 'next/link'
import { ST } from '@/lib/dominio/constantes'
import { brl, cap, dow, fData, hm, MESES, toD } from '@/lib/dominio/formato'
import { cobra, total } from '@/lib/dominio/locacao'
import type { LocacaoCompleta } from '@/lib/tipos'

/** Nome para exibir: cliente (dono/operador) ou responsável no local (entregador). */
export const nomeLocacao = (l: LocacaoCompleta) => l.clientes?.nome ?? l.resp_nome ?? 'Cliente'
export const itensTxt = (l: LocacaoCompleta) =>
  l.locacao_itens.map((i) => (i.quantidade > 1 ? i.quantidade + '× ' : '') + i.nome).join(', ')

export function Status({ s }: { s: LocacaoCompleta['status'] }) {
  return <span className={'st ' + ST[s][1]}>{ST[s][0]}</span>
}

export function CardLocacao({ l, pago, verValores }: { l: LocacaoCompleta; pago?: number; verValores: boolean }) {
  const d = toD(l.data_inicio)
  const tot = total({ frete: l.frete, desconto: l.desconto, itens: l.locacao_itens })
  const sd = tot - (pago ?? 0)
  const mult = l.data_fim !== l.data_inicio
  return (
    <Link className="card loc" href={`/locacoes/${l.id}`}>
      <div className="dt">
        <b>{d.getDate()}</b>
        <span>{MESES[d.getMonth()].slice(0, 3)}</span>
      </div>
      <div>
        <div className="row">
          <strong>{nomeLocacao(l)}</strong>
          <Status s={l.status} />
        </div>
        <small>
          {cap(dow(l.data_inicio))} – entrega {hm(l.hora_entrega) || '--:--'}, retirada {hm(l.hora_retirada) || '--:--'}
          {mult ? ' em ' + fData(l.data_fim) : ''}
        </small>
        <small>{itensTxt(l)}</small>
        {verValores ? (
          <div className="row" style={{ marginTop: 4 }}>
            <span>{brl(tot)}</span>
            {cobra(l.status) && (sd > 0.004 ? <span className="due">Falta {brl(sd)}</span> : <span className="paid">Pago</span>)}
          </div>
        ) : (
          <small>{l.endereco_evento}</small>
        )}
      </div>
    </Link>
  )
}

/** Entregas e retiradas de um dia (Início e Agenda). */
export function ListaEventos({ locacoes, dia }: { locacoes: LocacaoCompleta[]; dia: string }) {
  const ev: { t: string; k: 'Entrega' | 'Retirada'; l: LocacaoCompleta }[] = []
  for (const l of locacoes) {
    if (!['confirmada', 'entregue', 'concluida'].includes(l.status)) continue
    if (l.data_inicio === dia) ev.push({ t: hm(l.hora_entrega), k: 'Entrega', l })
    if (l.data_fim === dia) ev.push({ t: hm(l.hora_retirada), k: 'Retirada', l })
  }
  ev.sort((a, b) => (a.t || '99').localeCompare(b.t || '99'))
  if (!ev.length) return <p className="empty">Nenhuma entrega ou retirada.</p>
  return (
    <>
      {ev.map((e) => (
        <Link key={e.l.id + e.k} className="card ev" href={`/locacoes/${e.l.id}`}>
          <time>{e.t || '--:--'}</time>
          <div>
            <span className={'kind ' + e.k}>{e.k}</span> {e.l.status === 'concluida' && <span className="st st-ok">Concluída</span>}
            <br />
            <strong>{nomeLocacao(e.l)}</strong>
            <small>{e.l.endereco_evento}</small>
            <small>{itensTxt(e.l)}</small>
          </div>
        </Link>
      ))}
    </>
  )
}
