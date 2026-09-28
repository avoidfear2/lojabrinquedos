'use client'

import { useState } from 'react'
import { Erro, useToast } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { salvarLink } from '@/lib/acoes/ajustes'
import { sugerirSlug } from '@/lib/reserva/tipos'

export function FormLink({ slug, nome, origem, ativo }: { slug: string | null; nome: string; origem: string; ativo: boolean }) {
  const { executar, erro, pendente } = useAcao()
  const toast = useToast()
  const [valor, setValor] = useState(slug ?? sugerirSlug(nome))
  const url = slug ? `${origem}/r/${slug}` : ''
  const msg = `Faça seu pedido de brinquedos com ${nome} por aqui: ${url}`
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault()
        executar(() => salvarLink(new FormData(e.currentTarget)))
      }}
    >
      <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Link de reserva</h2>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '.92rem' }}>
        Seus clientes escolhem data e brinquedos e enviam o pedido. Ele entra aqui como orçamento, e você confirma. O pagamento é sempre combinado direto com você.
      </p>
      {!ativo && (
        <div className="note">O link fica disponível para os clientes nos planos Profissional e Equipe. Você já pode escolher o endereço.</div>
      )}
      <label className="f">
        <span>Endereço do link</span>
        <input name="slug" value={valor} onChange={(e) => setValor(sugerirSlug(e.target.value))} placeholder="pula-alegria" inputMode="url" autoCapitalize="none" />
      </label>
      <small>{origem}/r/{valor || '…'}</small>
      <Erro msg={erro} />
      <div className="acts">
        <button className="btn primary" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar link'}</button>
      </div>
      {slug && ativo && (
        <div className="copiar" style={{ marginTop: 12 }}>
          <code>{url}</code>
          <button
            type="button"
            className="btn ghost sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                toast('Link copiado')
              } catch {
                toast('Não foi possível copiar. Selecione o endereço e copie.')
              }
            }}
          >
            Copiar
          </button>
          <a className="btn ghost sm" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener">Enviar no WhatsApp</a>
          <a className="btn ghost sm" href={url} target="_blank" rel="noopener">Abrir</a>
        </div>
      )}
    </form>
  )
}
