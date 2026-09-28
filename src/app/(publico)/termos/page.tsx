import type { Metadata } from 'next'
import { lerTermos } from '@/lib/termos'

export const metadata: Metadata = { title: 'Termos de Uso' }

export default async function Termos() {
  const { versao, pendente, blocos } = await lerTermos()
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Versão {versao}</p>
      {pendente && <div className="banner info">Versão preliminar: ainda faltam informações neste texto.</div>}
      <article className="termos">
        {blocos.map((b, i) =>
          b.tipo === 'h1' ? <h2 key={i}>{b.texto}</h2> : b.tipo === 'h2' ? <h2 key={i}>{b.texto}</h2> : b.tipo === 'li' ? <p key={i}>• {b.texto}</p> : <p key={i}>{b.texto}</p>,
        )}
      </article>
    </>
  )
}
