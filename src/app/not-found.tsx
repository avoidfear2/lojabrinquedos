import Link from 'next/link'

export default function NaoEncontrado() {
  return (
    <main style={{ paddingTop: 60, textAlign: 'center' }}>
      <h1 className="hello">Não encontrado</h1>
      <p className="muted">Esta página não existe ou você não tem acesso a ela.</p>
      <Link className="btn primary" href="/inicio">Voltar ao início</Link>
    </main>
  )
}
