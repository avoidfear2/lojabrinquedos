import type { Metadata } from 'next'
import Link from 'next/link'
import { CardLocacao, itensTxt, nomeLocacao } from '@/components/locacao'
import { listarLocacoes, pagosPorLocacao } from '@/lib/dados'
import { hoje } from '@/lib/dominio/formato'
import { numeroContrato, total } from '@/lib/dominio/locacao'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import type { LocacaoCompleta } from '@/lib/tipos'

export const metadata: Metadata = { title: 'Locações' }

const FILTROS = [
  ['proximas', 'Próximas'],
  ['orcamentos', 'Orçamentos'],
  ['receber', 'A receber'],
  ['concluidas', 'Concluídas'],
  ['canceladas', 'Canceladas'],
  ['todas', 'Todas'],
] as const
type Filtro = (typeof FILTROS)[number][0]

export default async function Locacoes({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const sp = await searchParams
  const ctx = await contexto()
  const papel = ctx.usuario.papel
  const verValores = pode.verValores(papel)
  const disponiveis = FILTROS.filter(([k]) => verValores || !['orcamentos', 'receber'].includes(k))
  const filtro: Filtro = (disponiveis.find(([k]) => k === sp.filtro)?.[0] ?? 'proximas') as Filtro
  const busca = (sp.q ?? '').trim()
  const h = hoje()

  let locs: LocacaoCompleta[]
  switch (filtro) {
    case 'proximas':
      locs = await listarLocacoes(ctx, { de: h, status: verValores ? ['orcamento', 'confirmada', 'entregue'] : ['confirmada', 'entregue'] })
      break
    case 'orcamentos':
      locs = await listarLocacoes(ctx, { status: ['orcamento'] })
      break
    case 'receber':
      locs = await listarLocacoes(ctx, { status: ['confirmada', 'entregue', 'concluida'] })
      break
    case 'concluidas':
      locs = await listarLocacoes(ctx, { status: ['concluida'], desc: true, limite: 300 })
      break
    case 'canceladas':
      locs = await listarLocacoes(ctx, { status: ['cancelada'], desc: true, limite: 300 })
      break
    default:
      locs = await listarLocacoes(ctx, { desc: true, limite: 300 })
  }

  const pagos = await pagosPorLocacao(ctx, locs.map((l) => l.id))
  if (filtro === 'receber') {
    locs = locs.filter((l) => total({ frete: l.frete, desconto: l.desconto, itens: l.locacao_itens }) - (pagos.get(l.id) ?? 0) > 0.004)
  }
  if (busca) {
    const q = busca.toLowerCase()
    locs = locs.filter((l) =>
      [nomeLocacao(l), itensTxt(l), l.endereco_evento, numeroContrato(l.numero, l.data_inicio)].join(' ').toLowerCase().includes(q),
    )
  }

  return (
    <>
      <div className="sh">
        <h2 className="page-h">Locações</h2>
        {pode.editarLocacoes(papel) && (
          <Link className="btn primary sm" href={`/locacoes/nova?dia=${h}`}>Nova locação</Link>
        )}
      </div>
      <div className="chips">
        {disponiveis.map(([k, t]) => (
          <Link key={k} className="chip" href={`/locacoes?filtro=${k}${busca ? '&q=' + encodeURIComponent(busca) : ''}`} aria-pressed={filtro === k}>
            {t}
          </Link>
        ))}
      </div>
      <form method="get" action="/locacoes" role="search">
        <input type="hidden" name="filtro" value={filtro} />
        <input
          className="search"
          type="search"
          name="q"
          defaultValue={busca}
          placeholder="Buscar por cliente, brinquedo ou endereço"
          aria-label="Buscar locações"
        />
      </form>
      {locs.length ? (
        locs.map((l) => <CardLocacao key={l.id} l={l} pago={pagos.get(l.id)} verValores={verValores} />)
      ) : (
        <p className="empty">Nenhuma locação aqui.</p>
      )}
    </>
  )
}
