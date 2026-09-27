import Link from 'next/link'
import { Icone } from './Icone'

export function Topo({ nome, subtitulo, ajustes = true }: { nome: string; subtitulo: string; ajustes?: boolean }) {
  return (
    <header className="top">
      <div className="top-in">
        <div className="brand">
          <b>{nome}</b>
          <span>{subtitulo}</span>
        </div>
        {ajustes && (
          <Link className="icon-btn" href="/ajustes" aria-label="Ajustes">
            <Icone nome="ajustes" />
          </Link>
        )}
      </div>
    </header>
  )
}
