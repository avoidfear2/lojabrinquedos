import type { Metadata } from 'next'
import Link from 'next/link'
import { CardLocacao } from '@/components/locacao'
import { listarBrinquedos, listarLocacoes, pagosPorLocacao, reservasNoPeriodo } from '@/lib/dados'
import { cap, diaValido, dow, DOW, fData, fimDoMes, hoje, MESES, mesValido, pad2, somaMes, toD } from '@/lib/dominio/formato'
import { livresNoPeriodo } from '@/lib/dominio/locacao'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'

export const metadata: Metadata = { title: 'Agenda' }

export default async function Agenda({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const sp = await searchParams
  const ctx = await contexto()
  const papel = ctx.usuario.papel
  const h = hoje()
  const dia = diaValido(sp.dia) ?? (mesValido(sp.mes) && sp.mes !== h.slice(0, 7) ? sp.mes + '-01' : h)
  const mes = mesValido(sp.mes) ?? dia.slice(0, 7)
  const [y, m] = mes.split('-').map(Number)
  const ini = mes + '-01'
  const fim = fimDoMes(mes)

  const [locs, brinquedos, reservas] = await Promise.all([
    listarLocacoes(ctx, { de: ini, ate: fim, status: ['orcamento', 'confirmada', 'entregue', 'concluida'] }),
    listarBrinquedos(ctx, true),
    reservasNoPeriodo(ctx, dia, dia),
  ])
  const noDia = (iso: string) => locs.filter((l) => l.data_inicio <= iso && l.data_fim >= iso)
  const doDia = noDia(dia).sort((a, b) => (a.hora_entrega ?? '').localeCompare(b.hora_entrega ?? ''))
  const pagos = await pagosPorLocacao(ctx, doDia.map((l) => l.id))

  const primeiro = new Date(y, m - 1, 1).getDay()
  const nd = new Date(y, m, 0).getDate()
  const dias = Array.from({ length: nd }, (_, i) => `${mes}-${pad2(i + 1)}`)

  return (
    <>
      <div className="mnav">
        <Link className="x" href={`/agenda?mes=${somaMes(mes, -1)}`} aria-label="Mês anterior">‹</Link>
        <h2>{MESES[m - 1]} {y}</h2>
        <Link className="x" href={`/agenda?mes=${somaMes(mes, 1)}`} aria-label="Próximo mês">›</Link>
      </div>
      <div className="cal">
        {DOW.map((w) => <div key={w} className="wd">{w}</div>)}
        {Array.from({ length: primeiro }, (_, i) => <div key={'b' + i} className="day blank" />)}
        {dias.map((iso) => {
          const ls = noDia(iso)
          const n = ls.filter((l) => l.status !== 'orcamento').length
          const cls = ['day', n ? 'busy' : '', iso === h ? 'today' : '', iso === dia ? 'sel' : ''].join(' ')
          return (
            <Link
              key={iso}
              className={cls}
              href={`/agenda?mes=${mes}&dia=${iso}`}
              scroll={false}
              aria-label={`${toD(iso).getDate()} de ${MESES[m - 1]}${n ? ', ' + n + ' locação(ões)' : ''}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="n">{toD(iso).getDate()}</span>
              {ls.length > 0 && <span className="c">{ls.length}</span>}
            </Link>
          )
        })}
      </div>

      <section style={{ marginTop: 22 }}>
        <div className="sh">
          <h2>{cap(dow(dia))}, {fData(dia)}</h2>
          {pode.editarLocacoes(papel) && (
            <Link className="btn primary sm" href={`/locacoes/nova?dia=${dia}`}>Nova locação</Link>
          )}
        </div>
        {doDia.length ? (
          doDia.map((l) => <CardLocacao key={l.id} l={l} pago={pagos.get(l.id)} verValores={pode.verValores(papel)} />)
        ) : (
          <p className="empty">Dia livre.</p>
        )}
      </section>

      <section>
        <div className="sh"><h2>Disponibilidade no dia</h2></div>
        <div className="card">
          {brinquedos.length ? (
            brinquedos.map((b) => {
              const q = b.quantidade
              const lv = livresNoPeriodo(q, reservas, b.id, dia, dia)
              const pc = q ? (lv / q) * 100 : 0
              return (
                <div className="av" key={b.id}>
                  <strong>{b.nome}</strong>
                  <span className={lv ? '' : 'due'}>{lv} de {q} livre{q > 1 ? 's' : ''}</span>
                  <div className="bar">
                    <i className={lv === 0 ? 'none' : pc < 50 ? 'low' : ''} style={{ width: `${Math.max(pc, lv ? 6 : 100)}%` }} />
                  </div>
                </div>
              )
            })
          ) : (
            <p className="muted">Cadastre brinquedos para ver a disponibilidade.</p>
          )}
        </div>
      </section>
    </>
  )
}
