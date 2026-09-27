'use client'

import { useState } from 'react'
import { BotaoConfirmar, Campo, Erro, Folha, Selecao } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { alterarMembro, convidarMembro } from '@/lib/acoes/equipe'
import { PAPEIS } from '@/lib/dominio/constantes'
import type { Papel, Usuario } from '@/lib/tipos'

const DESCRICAO: Record<Papel, string> = {
  dono: 'Tudo, inclusive dados da locadora e equipe.',
  operador: 'Locações, agenda, clientes, brinquedos e caixa.',
  entregador: 'Agenda e locações sem valores; registra entrega e retirada. Não vê clientes nem caixa.',
}
const OPCOES: [Papel, string][] = [
  ['operador', 'Operador'],
  ['entregador', 'Entregador'],
  ['dono', 'Dono'],
]

export function TelaEquipe({ membros, eu }: { membros: Usuario[]; eu: string }) {
  const [convite, setConvite] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  return (
    <>
      <div className="sh">
        <h2 className="page-h">Equipe</h2>
        <button className="btn primary sm" onClick={() => setConvite(true)}>Convidar</button>
      </div>
      <div className="card">
        <ul className="lista-simples">
          {membros.map((m) => (
            <li key={m.id} className="row">
              <div>
                <strong>{m.nome}</strong> {m.id === eu && <span className="pill">você</span>} {!m.ativo && <span className="tag">Desativado</span>}
                <small>{PAPEIS[m.papel]} – {DESCRICAO[m.papel]}</small>
              </div>
              {m.id !== eu && (
                <button className="btn ghost sm" onClick={() => setEditando(m)}>Alterar</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Folha titulo="Convidar para a equipe" aberta={convite} onFechar={() => setConvite(false)}>
        {convite && <FormConvite onFim={() => setConvite(false)} />}
      </Folha>
      <Folha titulo={editando?.nome ?? ''} aberta={!!editando} onFechar={() => setEditando(null)}>
        {editando && <FormMembro m={editando} onFim={() => setEditando(null)} />}
      </Folha>
    </>
  )
}

function FormConvite({ onFim }: { onFim: () => void }) {
  const { executar, erro, pendente } = useAcao()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        executar(() => convidarMembro(new FormData(e.currentTarget)), onFim)
      }}
    >
      <p className="muted" style={{ marginTop: 0 }}>A pessoa recebe um e-mail para criar a senha e aceitar os Termos de Uso no primeiro acesso.</p>
      <Campo rotulo="Nome" name="nome" obrigatorio />
      <Campo rotulo="E-mail" name="email" type="email" inputMode="email" obrigatorio />
      <Selecao rotulo="Papel" name="papel" opcoes={OPCOES} defaultValue="operador" />
      <Erro msg={erro} />
      <div className="acts">
        <button className="btn primary" disabled={pendente}>{pendente ? 'Enviando…' : 'Enviar convite'}</button>
      </div>
    </form>
  )
}

function FormMembro({ m, onFim }: { m: Usuario; onFim: () => void }) {
  const { executar, erro, pendente } = useAcao()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const papel = new FormData(e.currentTarget).get('papel') as Papel
        executar(() => alterarMembro(m.id, { papel }), onFim)
      }}
    >
      <Selecao rotulo="Papel" name="papel" opcoes={OPCOES} defaultValue={m.papel} />
      <Erro msg={erro} />
      <div className="acts">
        {m.ativo ? (
          <BotaoConfirmar disabled={pendente} onConfirmar={() => executar(() => alterarMembro(m.id, { ativo: false }), onFim)}>Desativar acesso</BotaoConfirmar>
        ) : (
          <button type="button" className="btn ghost" disabled={pendente} onClick={() => executar(() => alterarMembro(m.id, { ativo: true }), onFim)}>Reativar acesso</button>
        )}
        <button className="btn primary" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar papel'}</button>
      </div>
    </form>
  )
}
