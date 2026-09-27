import type { Metadata } from 'next'
import Link from 'next/link'
import { CardLocacao, ListaEventos, nomeLocacao } from '@/components/locacao'
import { caixaDoPeriodo, listarLocacoes, pagosPorLocacao } from '@/lib/dados'
import { addDays, brl, cap, DOWL, fData, fimDoMes, hoje, MESES, toD } from '@/lib/dominio/formato'
import { numeroContrato, total } from '@/lib/dominio/locacao'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'

export const metadata: Metadata = { title: 'Início' }

export default async function Inicio() {
  const ctx = await contexto()
  const papel = ctx.usuario.papel
  const verValores = pode.verValores(papel)
  const h = hoje()
  const am = addDays(h, 1)
  const d = toD(h)
  const mes = h.slice(0, 7)

  const [doisDias, futuras, cobraveis, cx, brinq] = await Promise.all([
    listarLocacoes(ctx, { de: h, ate: am, status: ['confirmada', 'entregue', 'concluida'] }),
    listarLocacoes(ctx, { de: h, status: ['orcamento', 'confirmada', 'entregue'] }),
    verValores ? listarLocacoes(ctx, { status: ['confirmada', 'entregue', 'concluida'] }) : Promise.resolve([]),
    pode.verCaixa(papel) ? caixaDoPeriodo(ctx, mes + '-01', fimDoMes(mes)) : Promise.resolve([]),
    ctx.supabase.from('brinquedos').select('id', { count: 'exact', head: true }),
  ])

  const pagos = await pagosPorLocacao(ctx, cobraveis.map((l) => l.id))
  const receber = cobraveis
    .map((l) => ({ l, sd: total({ frete: l.frete, desconto: l.desconto, itens: l.locacao_itens }) - (pagos.get(l.id) ?? 0) }))
    .filter((x) => x.sd > 0.004)
  const recTot = receber.reduce((a, x) => a + x.sd, 0)
  const proximas = futuras.filter((l) => l.status !== 'orcamento' && l.data_inicio > am).slice(0, 5)
  const orc = futuras.filter((l) => l.status === 'orcamento').length
  const ent = cx.filter((c) => c.tipo === 'entrada').reduce((a, c) => a + Number(c.valor), 0)
  const sai = cx.filter((c) => c.tipo === 'saida').reduce((a, c) => a + Number(c.valor), 0)
  const semBrinquedos = pode.editarCadastros(papel) && (brinq.count ?? 0) === 0

  return (
    <>
      <h1 className="hello">
        {DOWL[d.getDay()]}, {d.getDate()} de {MESES[d.getMonth()]}
      </h1>

      {semBrinquedos && (
        <section className="card onb">
          <h2>Primeiros passos</h2>
          <ol>
            {pode.editarLocadora(papel) && (
              <li>
                <Link className="lnk" href="/ajustes">Preencha os dados da sua locadora</Link>: telefone, endereço, Pix e condições.
              </li>
            )}
            <li>
              <Link className="lnk" href="/cadastros/brinquedos?novo=1">Cadastre seus brinquedos</Link> com quantidade e valor.
            </li>
            <li>Cadastre o cliente e registre a primeira locação.</li>
          </ol>
        </section>
      )}

      <section>
        <div className="sh">
          <h2>Hoje</h2>
          {pode.editarLocacoes(papel) && (
            <Link className="btn primary sm" href={`/locacoes/nova?dia=${h}`}>Nova locação</Link>
          )}
        </div>
        <ListaEventos locacoes={doisDias} dia={h} />
      </section>

      <section>
        <div className="sh"><h2>Amanhã</h2></div>
        <ListaEventos locacoes={doisDias} dia={am} />
      </section>

      {pode.verCaixa(papel) && (
        <section>
          <div className="sh">
            <h2>{cap(MESES[d.getMonth()])} no caixa</h2>
            <Link className="lnk" href="/caixa">Abrir caixa</Link>
          </div>
          <div className="stats">
            <div className="stat in"><span>Entradas</span><b>{brl(ent)}</b></div>
            <div className="stat out"><span>Saídas</span><b>{brl(sai)}</b></div>
            <div className="stat"><span>Saldo</span><b>{brl(ent - sai)}</b></div>
          </div>
        </section>
      )}

      {verValores && (
        <section>
          <div className="sh">
            <h2>A receber</h2>
            <b>{brl(recTot)}</b>
          </div>
          {receber.length ? (
            receber.slice(0, 6).map(({ l, sd }) => (
              <Link key={l.id} className="card row" href={`/locacoes/${l.id}`} style={{ display: 'flex' }}>
                <div>
                  <strong>{nomeLocacao(l)}</strong>
                  <small>{fData(l.data_inicio)} · contrato {numeroContrato(l.numero, l.data_inicio)}</small>
                </div>
                <span className="due">{brl(sd)}</span>
              </Link>
            ))
          ) : (
            <p className="empty">Nenhum saldo em aberto.</p>
          )}
          {receber.length > 6 && (
            <p><Link className="lnk" href="/locacoes?filtro=receber">Ver todas ({receber.length})</Link></p>
          )}
        </section>
      )}

      <section>
        <div className="sh">
          <h2>Próximas reservas</h2>
          {orc > 0 && pode.editarLocacoes(papel) && (
            <Link className="lnk" href="/locacoes?filtro=orcamentos">
              {orc} orçamento{orc > 1 ? 's' : ''} em aberto
            </Link>
          )}
        </div>
        {proximas.length ? (
          proximas.map((l) => <CardLocacao key={l.id} l={l} pago={pagos.get(l.id)} verValores={verValores} />)
        ) : (
          <p className="empty">Nenhuma reserva depois de amanhã.</p>
        )}
      </section>
    </>
  )
}
