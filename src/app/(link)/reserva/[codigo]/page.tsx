import type { Metadata } from 'next'
import { fData, fTel, onlyDig } from '@/lib/dominio/formato'
import { numeroContrato } from '@/lib/dominio/locacao'
import type { ConsultaPedido } from '@/lib/reserva/tipos'
import { supabaseAnon } from '@/lib/supabase/anon'

export const metadata: Metadata = { title: 'Seu pedido', robots: { index: false, follow: false } }

const SITUACAO: Record<ConsultaPedido['status'], [string, string, string]> = {
  orcamento: ['Pedido recebido', 'st-orc', 'A locadora vai conferir a disponibilidade e entrar em contato para confirmar.'],
  confirmada: ['Reserva confirmada', 'st-conf', 'Sua data está reservada.'],
  entregue: ['Brinquedos no local', 'st-ent', 'Os brinquedos foram entregues e montados.'],
  concluida: ['Locação concluída', 'st-ok', 'Obrigado pela preferência!'],
  cancelada: ['Pedido cancelado', 'st-canc', 'Este pedido foi cancelado. Em caso de dúvida, fale com a locadora.'],
}

export default async function Pedido({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const { data } = /^[0-9a-f]{24}$/.test(codigo) ? await supabaseAnon().rpc('reserva_consultar', { p_codigo: codigo }) : { data: null }
  const p = data as ConsultaPedido | null

  if (!p) {
    return (
      <main>
        <h1>Pedido não encontrado</h1>
        <p className="lead">Confira o link que você recebeu ou fale com a empresa de locação.</p>
      </main>
    )
  }
  const [titulo, classe, texto] = SITUACAO[p.status]
  const tel = onlyDig(p.telefone_locador)
  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <b>{p.locador}</b>
            <span>Pedido nº {numeroContrato(p.numero, p.data_inicio)}</span>
          </div>
        </div>
      </header>
      <main>
        <h1>{titulo}</h1>
        <p><span className={'st ' + classe}>{titulo}</span></p>
        <p className="lead">{texto}</p>
        <div className="blk">
          <h3>Quando</h3>
          <p>{p.data_fim !== p.data_inicio ? `De ${fData(p.data_inicio)} a ${fData(p.data_fim)}` : fData(p.data_inicio)}</p>
        </div>
        <div className="blk">
          <h3>Brinquedos</h3>
          {(p.itens ?? []).map((i, n) => (
            <p key={n}>{i.quantidade}× {i.nome}</p>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.9rem' }}>Guarde este link para acompanhar o pedido.</p>
        {tel && (
          <div className="acts">
            <a className="btn primary" href={`https://wa.me/55${tel}?text=${encodeURIComponent(`Olá! Fiz o pedido nº ${numeroContrato(p.numero, p.data_inicio)} pelo link de reserva.`)}`} target="_blank" rel="noopener">
              Falar com {p.locador} no WhatsApp ({fTel(tel)})
            </a>
          </div>
        )}
      </main>
    </>
  )
}
