'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { FotosVistoria } from '@/components/FotosVistoria'
import { itensTxt, nomeLocacao, Status } from '@/components/locacao'
import { useSessao } from '@/components/Sessao'
import { Area, BotaoConfirmar, Campo, Erro, Folha, Selecao } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { salvarLancamento } from '@/lib/acoes/caixa'
import { excluirLocacao, mudarStatus, registrarVistoria } from '@/lib/acoes/locacoes'
import { CAT_ENT, CHECK, FORMAS } from '@/lib/dominio/constantes'
import { brl, cap, dow, fCPF, fData, fDataHora, fTel, hm, hoje, nfmt, onlyDig } from '@/lib/dominio/formato'
import { cobra, numeroContrato, total } from '@/lib/dominio/locacao'
import { pode } from '@/lib/permissoes'
import type { LancamentoCaixa, LocacaoCompleta, Vistoria, VistoriaFase } from '@/lib/tipos'

interface Props {
  l: LocacaoCompleta
  pagamentos: LancamentoCaixa[]
  vistorias: Vistoria[]
  locadora: { nome: string; pix: string | null }
  contratoAssinado: boolean
  fotosUrls: Record<string, string>
}

export function DetalheLocacao({ l, pagamentos, vistorias, locadora, contratoAssinado, fotosUrls }: Props) {
  const router = useRouter()
  const { papel } = useSessao()
  const { executar, erro, pendente } = useAcao()
  const [folha, setFolha] = useState<'pagar' | VistoriaFase | null>(null)

  const verValores = pode.verValores(papel)
  const editar = pode.editarLocacoes(papel)
  const tot = total({ frete: l.frete, desconto: l.desconto, itens: l.locacao_itens })
  const pg = pagamentos.filter((p) => p.tipo === 'entrada').reduce((a, p) => a + Number(p.valor), 0)
  const sd = tot - pg
  const num = numeroContrato(l.numero, l.data_inicio)
  const c = l.clientes
  const tel = onlyDig(c?.telefone ?? l.resp_telefone)
  const respTel = onlyDig(l.resp_telefone)

  const msg =
    `Olá, ${(c?.nome ?? '').split(' ')[0]}! Sua locação está ${l.status === 'orcamento' ? 'orçada' : 'confirmada'}.\n\n` +
    `Data: ${cap(dow(l.data_inicio))}, ${fData(l.data_inicio)}\n` +
    `Entrega: ${hm(l.hora_entrega) || 'a combinar'}\n` +
    `Retirada: ${hm(l.hora_retirada) || 'a combinar'}${l.data_fim !== l.data_inicio ? ' em ' + fData(l.data_fim) : ''}\n` +
    `Brinquedos: ${itensTxt(l)}\nLocal: ${l.endereco_evento}\n\n` +
    `Total: ${brl(tot)}\nPago: ${brl(pg)}\nSaldo: ${brl(Math.max(0, sd))}` +
    (locadora.pix ? `\nPix: ${locadora.pix}` : '') +
    `\n\n${locadora.nome}`

  const vistoria = (f: VistoriaFase) => vistorias.find((v) => v.fase === f)
  const proximo =
    l.status === 'orcamento' && editar ? (
      <button className="btn primary" disabled={pendente} onClick={() => executar(() => mudarStatus(l.id, 'confirmada'))}>Confirmar reserva</button>
    ) : l.status === 'confirmada' ? (
      <button className="btn primary" onClick={() => setFolha('entrega')}>Registrar entrega</button>
    ) : l.status === 'entregue' ? (
      <button className="btn primary" onClick={() => setFolha('retirada')}>Registrar retirada</button>
    ) : null

  return (
    <>
      <div className="sh">
        <h1 className="page-h">{nomeLocacao(l)}</h1>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Status s={l.status} />
        <span className="muted">Contrato {num}</span>
      </div>
      <div className="acts" style={{ margin: '0 0 12px' }}>
        {proximo}
        {l.status !== 'orcamento' && l.status !== 'cancelada' && (
          <Link className="btn yellow" href={`/locacoes/${l.id}/documento`}>Contrato e termo{contratoAssinado ? ' ✓' : ''}</Link>
        )}
      </div>
      <Erro msg={folha ? '' : erro} />

      <div className="blk">
        <h3>Quando</h3>
        <p>
          <b>Entrega:</b> {cap(dow(l.data_inicio))}, {fData(l.data_inicio)} às {hm(l.hora_entrega) || '—'}
          <br />
          <b>Retirada:</b> {cap(dow(l.data_fim))}, {fData(l.data_fim)} às {hm(l.hora_retirada) || '—'}
        </p>
      </div>
      <div className="blk">
        <h3>Onde</h3>
        <p>{l.endereco_evento}</p>
        <a className="lnk" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.endereco_evento)}`} target="_blank" rel="noopener">
          Abrir no mapa
        </a>
      </div>
      <div className="blk">
        <h3>{c ? 'Locatário' : 'Responsável no local'}</h3>
        {c ? (
          <p>
            <b>{c.nome}</b>
            <br />
            CPF {fCPF(c.cpf)}
            {c.telefone ? <><br />{fTel(c.telefone)}</> : null}
          </p>
        ) : null}
        {(!c || (l.resp_cpf && onlyDig(l.resp_cpf) !== c.cpf)) && l.resp_nome && (
          <p>
            {c && <b>Responsável no local: </b>}
            {l.resp_nome}
            {l.resp_telefone ? ', ' : ''}
            {respTel ? <a href={`tel:+55${respTel}`}>{fTel(respTel)}</a> : null}
          </p>
        )}
        {!c && respTel && <a className="btn ghost sm" href={`tel:+55${respTel}`}>Ligar para o responsável</a>}
      </div>

      <div className="blk">
        <h3>Brinquedos{verValores ? ' e valores' : ''}</h3>
        <table className="lines">
          <tbody>
            {l.locacao_itens.map((i) => (
              <tr key={i.id}>
                <td style={verValores ? undefined : { textAlign: 'left' }}>{i.quantidade}× {i.nome}</td>
                {verValores && <td>{brl(i.quantidade * Number(i.valor))}</td>}
              </tr>
            ))}
            {verValores && (
              <>
                {Number(l.frete) > 0 && <tr><td>Taxa de entrega</td><td>{brl(l.frete)}</td></tr>}
                {Number(l.desconto) > 0 && <tr><td>Desconto</td><td>− {brl(l.desconto)}</td></tr>}
                <tr className="t"><td>Total</td><td>{brl(tot)}</td></tr>
                <tr><td>Pago</td><td>{brl(pg)}</td></tr>
                <tr>
                  <td><b>{sd >= 0 ? 'Falta receber' : 'Pago a mais'}</b></td>
                  <td><b className={sd > 0.004 ? 'due' : 'paid'}>{brl(Math.abs(sd))}</b></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        {verValores && Number(l.caucao) > 0 && <small>Caução combinada: {brl(l.caucao)}</small>}
        {verValores && <small>{l.forma_pagamento ?? ''}{l.condicoes ? ' – ' + l.condicoes : ''}</small>}
      </div>

      {pode.verCaixa(papel) && (
        <div className="blk">
          <h3>Pagamentos</h3>
          {pagamentos.length ? (
            pagamentos.map((p) => (
              <div className="row" key={p.id}>
                <span>{fData(p.data)} – {p.forma ?? p.categoria}</span>
                <b>{p.tipo === 'saida' ? '− ' : ''}{brl(p.valor)}</b>
              </div>
            ))
          ) : (
            <p className="muted">Nenhum pagamento registrado.</p>
          )}
          {cobra(l.status) || l.status === 'orcamento' ? (
            <div className="acts" style={{ marginTop: 10 }}>
              <button className="btn green sm" onClick={() => setFolha('pagar')}>Registrar pagamento</button>
            </div>
          ) : null}
        </div>
      )}

      {(['entrega', 'retirada'] as const).map((f) => {
        const v = vistoria(f)
        if (!v) return null
        return (
          <div className="blk" key={f}>
            <h3>{f === 'entrega' ? 'Entrega' : 'Retirada'} registrada – {fDataHora(v.feita_em)}</h3>
            {v.itens.map((t) => <small key={t}>✓ {t}</small>)}
            {v.observacoes && <p style={{ marginTop: 6 }}>{v.observacoes}</p>}
            {v.fotos?.length > 0 && (
              <div className="fotos" style={{ marginTop: 8 }}>
                {v.fotos.map((f) =>
                  fotosUrls[f] ? (
                    <a key={f} className="foto" href={fotosUrls[f]} target="_blank" rel="noopener" aria-label="Abrir foto">
                      <img src={fotosUrls[f]} alt={`Foto da ${v.fase}`} loading="lazy" />
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </div>
        )
      })}

      {l.observacoes && (
        <div className="blk">
          <h3>Observações</h3>
          <p style={{ whiteSpace: 'pre-line' }}>{l.observacoes}</p>
        </div>
      )}

      <div className="acts">
        {verValores && tel && (
          <a className="btn ghost" href={`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener">
            Enviar resumo no WhatsApp
          </a>
        )}
        {editar && <Link className="btn ghost" href={`/locacoes/${l.id}/editar`}>Editar</Link>}
        {editar && l.status !== 'cancelada' && l.status !== 'concluida' && (
          <BotaoConfirmar disabled={pendente} onConfirmar={() => executar(() => mudarStatus(l.id, 'cancelada'))}>Cancelar locação</BotaoConfirmar>
        )}
        {editar && (
          <BotaoConfirmar disabled={pendente} onConfirmar={() => executar(() => excluirLocacao(l.id), () => router.push('/locacoes'))}>Excluir</BotaoConfirmar>
        )}
      </div>

      <Folha titulo="Registrar pagamento" aberta={folha === 'pagar'} onFechar={() => setFolha(null)}>
        {folha === 'pagar' && (
          <FormPagamento l={l} saldo={Math.max(0, sd)} num={num} onFim={() => setFolha(null)} />
        )}
      </Folha>
      <Folha titulo={folha === 'retirada' ? 'Registrar retirada' : 'Registrar entrega'} aberta={folha === 'entrega' || folha === 'retirada'} onFechar={() => setFolha(null)}>
        {(folha === 'entrega' || folha === 'retirada') && (
          <FormVistoria l={l} fase={folha} saldo={verValores ? sd : 0} contratoAssinado={contratoAssinado} onPagar={() => setFolha('pagar')} onFim={() => setFolha(null)} />
        )}
      </Folha>
    </>
  )
}

function FormPagamento({ l, saldo, num, onFim }: { l: LocacaoCompleta; saldo: number; num: string; onFim: () => void }) {
  const { executar, erro, pendente } = useAcao()
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Contrato {num} – {nomeLocacao(l)}. Saldo: <b>{brl(saldo)}</b>
      </p>
      <p className="muted" style={{ fontSize: '.9rem' }}>Anote aqui o valor que você recebeu do cliente. O app só registra; o pagamento é feito direto entre você e o cliente.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          fd.set('tipo', 'entrada')
          fd.set('locacao_id', l.id)
          executar(() => salvarLancamento(fd), onFim)
        }}
      >
        <div className="g2">
          <Campo rotulo="Valor recebido (R$)" name="valor" inputMode="decimal" defaultValue={nfmt(saldo)} obrigatorio />
          <Campo rotulo="Data" name="data" type="date" defaultValue={hoje()} obrigatorio />
        </div>
        <div className="g2">
          <Selecao rotulo="Forma" name="forma" opcoes={FORMAS} defaultValue={l.forma_pagamento ?? 'Pix'} />
          <Selecao rotulo="Categoria" name="categoria" opcoes={CAT_ENT} defaultValue="Locação" />
        </div>
        <Erro msg={erro} />
        <div className="acts">
          <button type="button" className="btn ghost" onClick={onFim}>Voltar</button>
          <button className="btn green" disabled={pendente}>{pendente ? 'Salvando…' : 'Registrar pagamento'}</button>
        </div>
      </form>
    </>
  )
}

function FormVistoria({ l, fase, saldo, contratoAssinado, onPagar, onFim }: { l: LocacaoCompleta; fase: VistoriaFase; saldo: number; contratoAssinado: boolean; onPagar: () => void; onFim: () => void }) {
  const { executar, erro, setErro, pendente } = useAcao()
  const { papel } = useSessao()
  const [fotos, setFotos] = useState<{ caminhos: string[]; enviando: boolean }>({ caminhos: [], enviando: false })
  const mudarFotos = useCallback((f: { caminhos: string[]; enviando: boolean }) => setFotos(f), [])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (fotos.enviando) return setErro('Aguarde as fotos terminarem de enviar.')
        const fd = new FormData(e.currentTarget)
        const itens = fd.getAll('item').map(String)
        executar(() => registrarVistoria(l.id, fase, itens, String(fd.get('obs') ?? ''), fotos.caminhos), onFim)
      }}
    >
      {fase === 'entrega' && !contratoAssinado && (
        <div className="note">
          O contrato ainda não foi assinado. <Link className="lnk" href={`/locacoes/${l.id}/documento`}>Colher assinaturas</Link>
        </div>
      )}
      {fase === 'retirada' && saldo > 0.004 && (
        <div className="warn">
          Ainda falta receber {brl(saldo)}.{' '}
          {pode.verCaixa(papel) && (
            <button type="button" className="lnk" onClick={onPagar}>Registrar pagamento</button>
          )}
        </div>
      )}
      {CHECK[fase].map((t) => (
        <label className="check" key={t}>
          <input type="checkbox" name="item" value={t} /> {t}
        </label>
      ))}
      <FotosVistoria locadoraId={l.locadora_id} locacaoId={l.id} fase={fase} onMudar={mudarFotos} />
      <Area rotulo={fase === 'entrega' ? 'Observações da entrega' : 'Avarias ou observações'} name="obs" />
      <Erro msg={erro} />
      <div className="acts">
        <button type="button" className="btn ghost" onClick={onFim}>Voltar</button>
        <button className="btn primary" disabled={pendente}>{pendente ? 'Salvando…' : fase === 'entrega' ? 'Confirmar entrega' : 'Confirmar retirada'}</button>
      </div>
    </form>
  )
}
