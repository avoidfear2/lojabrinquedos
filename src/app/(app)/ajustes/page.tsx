import type { Metadata } from 'next'
import Link from 'next/link'
import { PAPEIS } from '@/lib/dominio/constantes'
import { fData } from '@/lib/dominio/formato'
import { pode } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'
import { FormAjustes } from './FormAjustes'

export const metadata: Metadata = { title: 'Ajustes' }

const NOME_PLANO = { essencial: 'Essencial', profissional: 'Profissional', equipe: 'Equipe' }
const STATUS_PLANO = { teste: 'Período de teste', ativa: 'Ativa', atrasada: 'Pagamento em atraso', cancelada: 'Cancelada' }

export default async function Ajustes() {
  const ctx = await contexto()
  const { usuario, locadora, plano, email } = ctx
  const dono = pode.editarLocadora(usuario.papel)
  return (
    <>
      <h1 className="hello">Ajustes</h1>

      {dono ? (
        <FormAjustes l={locadora} />
      ) : (
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>{locadora.nome}</h2>
          <p className="muted" style={{ margin: 0 }}>Só o dono da conta altera os dados da locadora.</p>
        </div>
      )}

      {pode.gerenciarEquipe(usuario.papel) && (
        <section style={{ marginTop: 22 }}>
          <Link className="card row" href="/ajustes/equipe" style={{ display: 'flex' }}>
            <div>
              <strong>Equipe</strong>
              <small>Convide operadores e entregadores</small>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        </section>
      )}

      {dono && plano && (
        <section>
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Seu plano</h2>
            <p style={{ margin: 0 }}>
              <b>{NOME_PLANO[plano.plano]}</b> · {STATUS_PLANO[plano.status]}
            </p>
            <small>{plano.status === 'teste' ? 'Teste até' : 'Vencimento'} {fData(plano.vencimento)}</small>
          </div>
        </section>
      )}

      <section>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Sua conta</h2>
          <p style={{ margin: '0 0 4px' }}>
            {usuario.nome} · {PAPEIS[usuario.papel]}
          </p>
          <small>{email}</small>
          <div className="acts">
            <Link className="btn ghost" href="/termos" target="_blank">Termos de Uso</Link>
            <form action="/auth/sair" method="post" style={{ display: 'contents' }}>
              <button className="btn ghost danger">Sair</button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}
