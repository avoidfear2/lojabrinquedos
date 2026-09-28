'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Erro } from '@/components/ui'
import { disponibilidadeLink, enviarPedido } from '@/lib/acoes/reserva'
import { brl, fCPF, fTel } from '@/lib/dominio/formato'
import type { CatalogoLink } from '@/lib/reserva/tipos'

export function FormPedido({ slug, locador, brinquedos, hoje }: { slug: string; locador: string; brinquedos: CatalogoLink['brinquedos']; hoje: string }) {
  const router = useRouter()
  const [pendente, start] = useTransition()
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ data_inicio: '', data_fim: '', hora_entrega: '', nome: '', cpf: '', telefone: '', email: '', endereco_evento: '', observacoes: '' })
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }))
  const [qtd, setQtd] = useState<Record<string, number>>({})
  const [livres, setLivres] = useState<Record<string, number> | null>(null)
  const [aceite, setAceite] = useState(false)

  const fim = f.data_fim && f.data_fim >= f.data_inicio ? f.data_fim : f.data_inicio
  useEffect(() => {
    if (!f.data_inicio) return setLivres(null)
    let vivo = true
    const t = setTimeout(async () => {
      const l = await disponibilidadeLink(slug, f.data_inicio, fim)
      if (vivo) setLivres(l)
    }, 250)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [slug, f.data_inicio, fim])

  const escolhidos = brinquedos.filter((b) => (qtd[b.id] ?? 0) > 0)
  const estimado = escolhidos.reduce((a, b) => a + (qtd[b.id] ?? 0) * Number(b.valor), 0)

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!aceite) return setErro(`Para enviar, autorize o envio dos seus dados para ${locador}.`)
    start(async () => {
      try {
        const r = await enviarPedido(slug, { ...f, data_fim: fim, itens: escolhidos.map((b) => ({ id: b.id, quantidade: qtd[b.id] })) })
        if (!r.ok) return setErro(r.erro)
        router.push(`/reserva/${r.dados}`)
      } catch {
        setErro('Não foi possível enviar. Verifique a conexão e tente de novo.')
      }
    })
  }

  return (
    <form onSubmit={enviar} noValidate>
      <fieldset style={{ marginTop: 0 }}>
        <legend>Quando é a festa?</legend>
        <div className="g2">
          <label className="f">
            <span>Data do evento <i aria-hidden="true">*</i></span>
            <input type="date" min={hoje} value={f.data_inicio} onChange={(e) => setF((o) => ({ ...o, data_inicio: e.target.value, data_fim: !o.data_fim || o.data_fim < e.target.value ? e.target.value : o.data_fim }))} />
          </label>
          <label className="f">
            <span>Horário de início</span>
            <input type="time" value={f.hora_entrega} onChange={(e) => set('hora_entrega', e.target.value)} />
          </label>
        </div>
        <label className="f">
          <span>Até (se for mais de um dia)</span>
          <input type="date" min={f.data_inicio || hoje} value={f.data_fim} onChange={(e) => set('data_fim', e.target.value)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Brinquedos</legend>
        {!f.data_inicio && <p className="muted" style={{ marginTop: -4 }}>Escolha a data para ver o que está livre.</p>}
        {brinquedos.map((b) => {
          const lv = livres ? livres[b.id] ?? 0 : null
          const q = qtd[b.id] ?? 0
          const esgotado = lv !== null && lv <= 0
          return (
            <div key={b.id} className={'it' + (q > 0 ? ' on' : '')}>
              <div>
                <strong>{b.nome}</strong>
                <span className="lv" style={{ display: 'block' }}>
                  {[b.categoria, b.dimensoes, b.faixa_etaria].filter(Boolean).join(' · ')}
                </span>
                <span className={'lv' + (esgotado ? ' bad' : '')} style={{ display: 'block' }}>
                  {lv === null ? `A partir de ${brl(b.valor)}` : esgotado ? 'Indisponível nesta data' : `${brl(b.valor)} · ${lv} disponíve${lv > 1 ? 'is' : 'l'}`}
                </span>
              </div>
              <div className="step">
                <button type="button" aria-label={`Menos ${b.nome}`} onClick={() => setQtd((o) => ({ ...o, [b.id]: Math.max(0, q - 1) }))}>−</button>
                <input type="number" readOnly value={q} aria-label={`Quantidade de ${b.nome}`} />
                <button
                  type="button"
                  aria-label={`Mais ${b.nome}`}
                  disabled={lv === null || q >= lv}
                  onClick={() => setQtd((o) => ({ ...o, [b.id]: q + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
        {escolhidos.length > 0 && (
          <div className="sum">
            <div className="row"><span>Valor estimado dos brinquedos</span><span className="big">{brl(estimado)}</span></div>
            <small>Frete e condições são informados por {locador} na confirmação.</small>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Seus dados</legend>
        <label className="f"><span>Nome completo <i aria-hidden="true">*</i></span><input value={f.nome} autoComplete="name" onChange={(e) => set('nome', e.target.value)} /></label>
        <div className="g2">
          <label className="f"><span>CPF <i aria-hidden="true">*</i></span><input inputMode="numeric" value={f.cpf} placeholder="000.000.000-00" onChange={(e) => set('cpf', fCPF(e.target.value))} /></label>
          <label className="f"><span>WhatsApp <i aria-hidden="true">*</i></span><input inputMode="tel" autoComplete="tel" value={f.telefone} placeholder="(41) 99999-9999" onChange={(e) => set('telefone', fTel(e.target.value))} /></label>
        </div>
        <label className="f"><span>E-mail</span><input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="f">
          <span>Endereço do evento <i aria-hidden="true">*</i></span>
          <textarea value={f.endereco_evento} placeholder="Rua, número, bairro, cidade – salão, condomínio, ponto de referência" onChange={(e) => set('endereco_evento', e.target.value)} />
        </label>
        <label className="f"><span>Observações</span><textarea value={f.observacoes} placeholder="Ex.: festa de 5 anos, acesso pela garagem" onChange={(e) => set('observacoes', e.target.value)} /></label>
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        <span>Autorizo o envio dos meus dados para {locador}, para responder a este pedido.</span>
      </label>
      <Erro msg={erro} />
      <div className="acts">
        <button className="btn primary" disabled={pendente}>{pendente ? 'Enviando…' : 'Enviar pedido'}</button>
      </div>
      <p className="muted" style={{ fontSize: '.88rem' }}>O pedido não é uma reserva confirmada nem gera cobrança. Pagamento e contrato são combinados diretamente com {locador}.</p>
    </form>
  )
}
