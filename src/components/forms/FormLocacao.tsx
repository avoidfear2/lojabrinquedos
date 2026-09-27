'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { FormCliente } from '@/components/forms/FormCliente'
import { Erro, Folha } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { salvarLocacao } from '@/lib/acoes/locacoes'
import type { EntradaLocacao } from '@/lib/acoes/tipos'
import { FORMAS, ST } from '@/lib/dominio/constantes'
import { brl, fCPF, fTel, MASCARAS, nfmt, numv, onlyDig } from '@/lib/dominio/formato'
import { bloqueia, conflitos, enderecoCliente, livresNoPeriodo, type Reserva } from '@/lib/dominio/locacao'
import { supabaseNavegador } from '@/lib/supabase/browser'
import type { Brinquedo, Cliente, LocacaoCompleta, LocacaoStatus } from '@/lib/tipos'

interface Linha {
  brinquedo_id: string | null
  nome: string
  quantidade: number
  valor: string
}

interface Props {
  clientes: Cliente[]
  brinquedos: Brinquedo[]
  locacao?: LocacaoCompleta | null
  dia?: string
  clienteInicial?: string
}

export function FormLocacao({ clientes: clientesIniciais, brinquedos, locacao: l, dia, clienteInicial }: Props) {
  const router = useRouter()
  const { executar, erro, setErro, pendente } = useAcao()
  const [clientes, setClientes] = useState(clientesIniciais)
  const [novoCliente, setNovoCliente] = useState(false)

  const cliAtual = l?.cliente_id ? clientesIniciais.find((c) => c.id === l.cliente_id) : undefined
  const [f, setF] = useState(() => ({
    cliente_id: l?.cliente_id ?? clienteInicial ?? '',
    data_inicio: l?.data_inicio ?? dia ?? '',
    data_fim: l?.data_fim ?? dia ?? '',
    hora_entrega: l ? (l.hora_entrega ?? '').slice(0, 5) : '09:00',
    hora_retirada: l ? (l.hora_retirada ?? '').slice(0, 5) : '18:00',
    mesmo_endereco: l ? !!cliAtual && l.endereco_evento === enderecoCliente(cliAtual) : true,
    endereco_evento: l?.endereco_evento ?? '',
    resp_cliente: l ? !l.resp_cpf || (!!cliAtual && onlyDig(l.resp_cpf) === cliAtual.cpf) : true,
    resp_nome: l?.resp_nome ?? '',
    resp_cpf: fCPF(l?.resp_cpf ?? ''),
    resp_telefone: fTel(l?.resp_telefone ?? ''),
    frete: nfmt(l?.frete ?? 0),
    desconto: nfmt(l?.desconto ?? 0),
    caucao: nfmt(l?.caucao ?? 0),
    forma_pagamento: l?.forma_pagamento ?? 'Pix',
    condicoes: l?.condicoes ?? '',
    status: (l?.status ?? 'confirmada') as LocacaoStatus,
    observacoes: l?.observacoes ?? '',
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }))

  // Linhas de brinquedos: ativos + os que já estão na locação (mesmo inativos ou excluídos)
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    const itens = l?.locacao_itens ?? []
    const noCadastro = brinquedos
      .filter((b) => b.ativo || itens.some((i) => i.brinquedo_id === b.id))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((b) => {
        const it = itens.find((i) => i.brinquedo_id === b.id)
        return { brinquedo_id: b.id, nome: b.nome, quantidade: it?.quantidade ?? 0, valor: nfmt(it ? it.valor : b.valor_diaria) }
      })
    const orfaos = itens.filter((i) => !i.brinquedo_id).map((i) => ({ brinquedo_id: null, nome: i.nome, quantidade: i.quantidade, valor: nfmt(i.valor) }))
    return [...noCadastro, ...orfaos]
  })
  const setLinha = (i: number, m: Partial<Linha>) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, ...m } : x)))

  // Reservas do período (atualiza quando as datas mudam)
  const [reservas, setReservas] = useState<Reserva[] | null>(null)
  const fim = f.data_fim && f.data_fim >= f.data_inicio ? f.data_fim : f.data_inicio
  useEffect(() => {
    if (!f.data_inicio) return
    let vivo = true
    const t = setTimeout(async () => {
      const { data } = await supabaseNavegador()
        .from('locacoes')
        .select('id,data_inicio,data_fim,locacao_itens(brinquedo_id,quantidade)')
        .in('status', ['confirmada', 'entregue'])
        .lte('data_inicio', fim)
        .gte('data_fim', f.data_inicio)
      if (!vivo) return
      const out: Reserva[] = []
      for (const x of (data ?? []) as { id: string; data_inicio: string; data_fim: string; locacao_itens: { brinquedo_id: string | null; quantidade: number }[] }[]) {
        for (const i of x.locacao_itens) if (i.brinquedo_id) out.push({ locacao_id: x.id, data_inicio: x.data_inicio, data_fim: x.data_fim, brinquedo_id: i.brinquedo_id, quantidade: i.quantidade })
      }
      setReservas(out)
    }, 250)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [f.data_inicio, fim])

  const estoque = useMemo(() => new Map(brinquedos.map((b) => [b.id, b.quantidade])), [brinquedos])
  const sub = linhas.reduce((a, x) => a + x.quantidade * numv(x.valor), 0)
  const tot = sub + numv(f.frete) - numv(f.desconto)
  const cli = clientes.find((c) => c.id === f.cliente_id)

  const statusOpcoes: LocacaoStatus[] = ['orcamento', 'confirmada', 'cancelada']
  if (l && (l.status === 'entregue' || l.status === 'concluida')) statusOpcoes.splice(2, 0, l.status)

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const itens = linhas.filter((x) => x.quantidade > 0)
    if (bloqueia(f.status) && reservas && f.data_inicio) {
      const cf = conflitos(
        itens.filter((x) => x.brinquedo_id).map((x) => ({ brinquedo_id: x.brinquedo_id!, nome: x.nome, quantidade: x.quantidade, estoque: estoque.get(x.brinquedo_id!) ?? 0 })),
        reservas,
        f.data_inicio,
        fim,
        l?.id,
      )
      if (cf.length) {
        setErro('Falta disponibilidade:\n' + cf.join('\n') + '\n\nAjuste as quantidades ou as datas, ou salve como orçamento.')
        return
      }
    }
    const d: EntradaLocacao = {
      id: l?.id,
      ...f,
      data_fim: fim,
      frete: numv(f.frete),
      desconto: numv(f.desconto),
      caucao: numv(f.caucao),
      itens: itens.map((x) => ({ brinquedo_id: x.brinquedo_id, nome: x.nome, quantidade: x.quantidade, valor: numv(x.valor) })),
    }
    executar(
      () => salvarLocacao(d),
      (id) => router.push(`/locacoes/${id}`),
    )
  }

  return (
    <>
      <form onSubmit={enviar} noValidate>
        <fieldset style={{ marginTop: 0 }}>
          <legend>Cliente</legend>
          <label className="f">
            <span>
              Locatário <i aria-hidden="true">*</i>
            </span>
            <select value={f.cliente_id} onChange={(e) => set('cliente_id', e.target.value)}>
              <option value="">Escolha um cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} – {fCPF(c.cpf)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="lnk" onClick={() => setNovoCliente(true)}>
            Cadastrar novo cliente
          </button>
        </fieldset>

        <fieldset>
          <legend>Quando</legend>
          <div className="g2">
            <label className="f">
              <span>Data da entrega <i aria-hidden="true">*</i></span>
              <input
                type="date"
                value={f.data_inicio}
                onChange={(e) => {
                  const v = e.target.value
                  setF((o) => ({ ...o, data_inicio: v, data_fim: !o.data_fim || o.data_fim < v ? v : o.data_fim }))
                }}
              />
            </label>
            <label className="f">
              <span>Horário da entrega</span>
              <input type="time" value={f.hora_entrega} onChange={(e) => set('hora_entrega', e.target.value)} />
            </label>
          </div>
          <div className="g2">
            <label className="f">
              <span>Data da retirada <i aria-hidden="true">*</i></span>
              <input type="date" value={f.data_fim} min={f.data_inicio} onChange={(e) => set('data_fim', e.target.value)} />
            </label>
            <label className="f">
              <span>Horário da retirada</span>
              <input type="time" value={f.hora_retirada} onChange={(e) => set('hora_retirada', e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Onde</legend>
          <label className="check">
            <input type="checkbox" checked={f.mesmo_endereco} onChange={(e) => set('mesmo_endereco', e.target.checked)} /> Evento no endereço do cliente
          </label>
          {f.mesmo_endereco ? (
            cli && <p className="muted" style={{ marginTop: -4 }}>{enderecoCliente(cli) || 'Cliente sem endereço cadastrado.'}</p>
          ) : (
            <label className="f">
              <span>Endereço do evento</span>
              <textarea
                value={f.endereco_evento}
                placeholder="Rua, número, bairro, cidade – salão, condomínio, ponto de referência"
                onChange={(e) => set('endereco_evento', e.target.value)}
              />
            </label>
          )}
        </fieldset>

        <fieldset>
          <legend>Responsável no local</legend>
          <label className="check">
            <input type="checkbox" checked={f.resp_cliente} onChange={(e) => set('resp_cliente', e.target.checked)} /> O próprio cliente cuidará dos brinquedos e das crianças
          </label>
          {!f.resp_cliente && (
            <>
              <label className="f">
                <span>Nome completo do responsável</span>
                <input value={f.resp_nome} onChange={(e) => set('resp_nome', e.target.value)} />
              </label>
              <div className="g2">
                <label className="f">
                  <span>CPF do responsável</span>
                  <input inputMode="numeric" value={f.resp_cpf} onChange={(e) => set('resp_cpf', MASCARAS.cpf(e.target.value))} />
                </label>
                <label className="f">
                  <span>Telefone</span>
                  <input inputMode="tel" value={f.resp_telefone} onChange={(e) => set('resp_telefone', MASCARAS.tel(e.target.value))} />
                </label>
              </div>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Brinquedos</legend>
          {linhas.length ? (
            linhas.map((x, i) => {
              const est = x.brinquedo_id ? estoque.get(x.brinquedo_id) ?? 0 : 0
              const lv = x.brinquedo_id && reservas && f.data_inicio ? livresNoPeriodo(est, reservas, x.brinquedo_id, f.data_inicio, fim, l?.id) : null
              return (
                <div key={(x.brinquedo_id ?? 'x') + i} className={'it' + (x.quantidade > 0 ? ' on' : '')}>
                  <div>
                    <strong>{x.nome}</strong>
                    {lv !== null && (
                      <span className={'lv' + (x.quantidade > lv ? ' bad' : '')} style={{ display: 'block' }}>
                        {lv <= 0 ? 'Sem unidade livre no período' : `${lv} de ${est} livre${lv > 1 ? 's' : ''} no período`}
                      </span>
                    )}
                    {!x.brinquedo_id && <span className="lv" style={{ display: 'block' }}>Brinquedo excluído do cadastro</span>}
                  </div>
                  <div className="step">
                    <button type="button" aria-label={`Menos ${x.nome}`} onClick={() => setLinha(i, { quantidade: Math.max(0, x.quantidade - 1) })}>−</button>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`Quantidade de ${x.nome}`}
                      value={x.quantidade}
                      onChange={(e) => setLinha(i, { quantidade: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                    <button type="button" aria-label={`Mais ${x.nome}`} onClick={() => setLinha(i, { quantidade: x.quantidade + 1 })}>+</button>
                  </div>
                  <label>
                    Valor unitário R$ <input inputMode="decimal" value={x.valor} onChange={(e) => setLinha(i, { valor: e.target.value })} />
                  </label>
                </div>
              )
            })
          ) : (
            <p className="empty">
              Nenhum brinquedo disponível. <Link className="lnk" href="/cadastros/brinquedos?novo=1">Cadastrar brinquedo</Link>
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend>Valores e pagamento</legend>
          <div className="g3">
            <label className="f"><span>Taxa de entrega</span><input inputMode="decimal" value={f.frete} onChange={(e) => set('frete', e.target.value)} /></label>
            <label className="f"><span>Desconto</span><input inputMode="decimal" value={f.desconto} onChange={(e) => set('desconto', e.target.value)} /></label>
            <label className="f"><span>Caução (garantia)</span><input inputMode="decimal" value={f.caucao} onChange={(e) => set('caucao', e.target.value)} /></label>
          </div>
          <div className="sum">
            <div className="row"><span>Brinquedos</span><span>{brl(sub)}</span></div>
            <div className="row"><span>Total do contrato</span><span className="big">{brl(tot)}</span></div>
          </div>
          <div className="g2">
            <label className="f">
              <span>Forma de pagamento</span>
              <select value={f.forma_pagamento} onChange={(e) => set('forma_pagamento', e.target.value)}>
                {FORMAS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="f">
              <span>Situação</span>
              <select value={f.status} onChange={(e) => set('status', e.target.value as LocacaoStatus)}>
                {statusOpcoes.map((s) => <option key={s} value={s}>{ST[s][0]}</option>)}
              </select>
            </label>
          </div>
          <label className="f">
            <span>Condições de pagamento</span>
            <input value={f.condicoes} placeholder="Ex.: 50% na reserva e 50% na entrega" onChange={(e) => set('condicoes', e.target.value)} />
          </label>
          {f.status === 'orcamento' && <p className="muted" style={{ fontSize: '.9rem' }}>Orçamento não bloqueia a data. Os brinquedos só ficam reservados quando a locação é confirmada.</p>}
        </fieldset>

        <label className="f">
          <span>Observações</span>
          <textarea value={f.observacoes} placeholder="Ex.: acesso pela garagem; tomada a 10 m" onChange={(e) => set('observacoes', e.target.value)} />
        </label>

        <Erro msg={erro} />
        <div className="acts">
          {l && <Link className="btn ghost" href={`/locacoes/${l.id}`}>Voltar</Link>}
          <button className="btn primary" disabled={pendente}>
            {pendente ? 'Salvando…' : l ? 'Salvar alterações' : 'Registrar locação'}
          </button>
        </div>
      </form>

      <Folha titulo="Novo cliente" aberta={novoCliente} onFechar={() => setNovoCliente(false)}>
        {novoCliente && (
          <FormCliente
            permitirExcluir={false}
            onFim={(c) => {
              setNovoCliente(false)
              if (c) {
                setClientes((cs) => [...cs.filter((x) => x.id !== c.id), c].sort((a, b) => a.nome.localeCompare(b.nome)))
                set('cliente_id', c.id)
              }
            }}
          />
        )}
      </Folha>
    </>
  )
}
