import type { Metadata } from 'next'
import { cache } from 'react'
import { fDoc, fTel, hoje, onlyDig } from '@/lib/dominio/formato'
import { slugValido, type CatalogoLink } from '@/lib/reserva/tipos'
import { supabaseAnon } from '@/lib/supabase/anon'
import { FormPedido } from './FormPedido'

const catalogo = cache(async (slug: string): Promise<CatalogoLink | null> => {
  if (!slugValido(slug)) return null
  const { data } = await supabaseAnon().rpc('reserva_catalogo', { p_slug: slug })
  return (data as CatalogoLink | null) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await catalogo((await params).slug)
  return { title: c ? `Reservar com ${c.locador.nome}` : 'Link de reserva' }
}

export default async function LinkReserva({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await catalogo(slug)

  if (!c) {
    return (
      <>
        <header className="top"><div className="top-in"><div className="brand"><b>Reserva</b></div></div></header>
        <main>
          <h1>Link indisponível</h1>
          <p className="lead">Este link de reserva não existe ou está desativado. Fale diretamente com a empresa de locação.</p>
        </main>
      </>
    )
  }

  const tel = onlyDig(c.locador.telefone)
  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <b>{c.locador.nome}</b>
            <span>{c.locador.cidade ? `Locação de brinquedos · ${c.locador.cidade}` : 'Locação de brinquedos'}</span>
          </div>
        </div>
      </header>
      <main>
        <h1>Faça seu pedido</h1>
        <p className="lead">
          Escolha a data e os brinquedos. {c.locador.nome} confere a disponibilidade e confirma com você, inclusive valores e forma de pagamento.
        </p>
        {c.brinquedos.length ? (
          <FormPedido slug={slug} locador={c.locador.nome} brinquedos={c.brinquedos} hoje={hoje()} />
        ) : (
          <p className="empty">Nenhum brinquedo disponível no momento.</p>
        )}
        <footer className="rodape-link">
          <p>{c.aviso}</p>
          <p>
            {c.locador.nome} · CPF/CNPJ {fDoc(c.locador.cpf_cnpj)}
            {tel && (
              <>
                {' · '}
                <a href={`https://wa.me/55${tel}`} target="_blank" rel="noopener">WhatsApp {fTel(tel)}</a>
              </>
            )}
          </p>
        </footer>
      </main>
    </>
  )
}
