'use client'

export default function ErroApp({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>Algo deu errado</h2>
      <p className="muted">Não foi possível carregar esta tela. Verifique a conexão e tente de novo.</p>
      <button className="btn primary" onClick={reset}>Tentar de novo</button>
    </div>
  )
}
