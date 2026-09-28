// Contrato de locação + termo de responsabilidade (texto do protótipo).
// Função pura: recebe os dados e devolve o HTML que é gravado em `documentos`.
// As assinaturas não entram no HTML gravado (o hash cobre só o texto); os
// lugares delas ficam marcados com <!--ASS:papel--> e são preenchidos na exibição.

import { brl, fCPF, fData, fDoc, fTel, MESES, numv } from '@/lib/dominio/formato'
import { enderecoCliente, numeroContrato, subtotal, total } from '@/lib/dominio/locacao'
import type { Brinquedo, Cliente, Locacao, LocacaoItem, Locadora } from '@/lib/tipos'

export const VERSAO_MODELO = 'contrato-1.0'

export type PapelAssinatura = 'locatario' | 'responsavel' | 'locador'
export interface Parte {
  nome: string
  cpf: string
}
export type Partes = Partial<Record<PapelAssinatura, Parte>>

export interface DadosDocumento {
  locadora: Pick<Locadora, 'nome' | 'cpf_cnpj' | 'telefone' | 'endereco' | 'cidade' | 'comarca_foro' | 'chave_pix' | 'canc_dias' | 'canc_pct' | 'taxa_visita' | 'clausulas_extras'>
  cliente: Pick<Cliente, 'nome' | 'cpf' | 'rg' | 'telefone' | 'email' | 'rua' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep'>
  locacao: Pick<Locacao, 'numero' | 'data_inicio' | 'data_fim' | 'hora_entrega' | 'hora_retirada' | 'endereco_evento' | 'resp_nome' | 'resp_cpf' | 'resp_telefone' | 'frete' | 'desconto' | 'caucao' | 'forma_pagamento' | 'condicoes'>
  itens: Pick<LocacaoItem, 'brinquedo_id' | 'nome' | 'quantidade' | 'valor'>[]
  brinquedos: Pick<Brinquedo, 'id' | 'dimensoes' | 'faixa_etaria' | 'capacidade' | 'energia' | 'regras'>[]
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const b = (t: string) => `<b>${esc(t)}</b>`

export function extenso(v: number): string {
  v = Math.round((+v || 0) * 100) / 100
  const int = Math.floor(v)
  const cent = Math.round((v - int) * 100)
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
  const a999 = (n: number) => {
    if (!n) return ''
    if (n === 100) return 'cem'
    const p: string[] = []
    const h = Math.floor(n / 100)
    const r = n % 100
    if (h) p.push(c[h])
    if (r) {
      if (r < 20) p.push(u[r])
      else {
        const t = Math.floor(r / 10)
        const o = r % 10
        p.push(o ? d[t] + ' e ' + u[o] : d[t])
      }
    }
    return p.join(' e ')
  }
  const inteiro = (n: number) => {
    if (!n) return 'zero'
    const mi = Math.floor(n / 1e6)
    const mil = Math.floor(n / 1000) % 1000
    const r = n % 1000
    const parts: string[] = []
    if (mi) parts.push(mi === 1 ? 'um milhão' : a999(mi) + ' milhões')
    if (mil) parts.push(mil === 1 ? 'mil' : a999(mil) + ' mil')
    if (r) parts.push(a999(r))
    let s = parts[0]
    for (let i = 1; i < parts.length; i++) {
      const last = i === parts.length - 1
      const lastVal = r ? r : mil * 1000
      s += last && (lastVal < 100 || lastVal % 100 === 0) ? ' e ' + parts[i] : ' ' + parts[i]
    }
    return s
  }
  let out = ''
  if (int) out = inteiro(int) + (int === 1 ? ' real' : int % 1e6 === 0 ? ' de reais' : ' reais')
  if (cent) out += (out ? ' e ' : '') + a999(cent) + (cent === 1 ? ' centavo' : ' centavos')
  return out || 'zero real'
}

export const dataExtenso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}

/** Dados obrigatórios do locador que ainda faltam em Ajustes. */
export function faltandoNoLocador(l: DadosDocumento['locadora']): string[] {
  const f: string[] = []
  if (!l.endereco) f.push('endereço')
  if (!l.cidade) f.push('cidade onde o contrato é assinado')
  if (!l.comarca_foro) f.push('comarca do foro')
  return f
}

/** Quem assina: locador, locatário e, se for outra pessoa, o responsável no local. */
export function partesDoDocumento(d: DadosDocumento): Partes {
  const cpfCli = d.cliente.cpf
  const respEhCliente = !d.locacao.resp_cpf || d.locacao.resp_cpf.replace(/\D/g, '') === cpfCli
  const p: Partes = {
    locador: { nome: d.locadora.nome, cpf: d.locadora.cpf_cnpj },
    locatario: { nome: d.cliente.nome, cpf: cpfCli },
  }
  if (!respEhCliente) p.responsavel = { nome: d.locacao.resp_nome ?? '', cpf: (d.locacao.resp_cpf ?? '').replace(/\D/g, '') }
  return p
}

/** Lê as partes gravadas no cabeçalho do documento (usado por quem não lê a tabela de clientes). */
export function partesGravadas(html: string): Partes {
  const m = html.match(/^<!--PARTES (.*?)-->/)
  if (!m) return {}
  try {
    return JSON.parse(m[1]) as Partes
  } catch {
    return {}
  }
}

export function gerarDocumento(d: DadosDocumento, dataIso: string): string {
  const { locadora: cfg, cliente: c, locacao: l } = d
  const num = numeroContrato(l.numero, l.data_inicio)
  const bs = new Map(d.brinquedos.map((x) => [x.id, x]))
  const doItem = (i: DadosDocumento['itens'][number]) => (i.brinquedo_id ? bs.get(i.brinquedo_id) : undefined)
  const energia = [...new Set(d.itens.map((i) => doItem(i)?.energia).filter((e): e is string => !!e && e !== 'Não precisa'))]
  const regras = d.itens.map((i) => ({ nome: i.nome, regras: doItem(i)?.regras })).filter((x) => x.regras)
  const tot = total({ frete: l.frete, desconto: l.desconto, itens: d.itens })
  const sub = subtotal({ itens: d.itens })
  const L = (v: string | null | undefined) => (v ? esc(v) : '<span class="falta">[preencher em Ajustes]</span>')
  const hm = (t: string | null) => (t ? t.slice(0, 5) : '__:__')
  const partes = partesDoDocumento(d)
  const resp = partes.responsavel ?? partes.locatario!
  const papelResp: PapelAssinatura = partes.responsavel ? 'responsavel' : 'locatario'
  const telResp = partes.responsavel ? l.resp_telefone : c.telefone
  const docLocador = fDoc(cfg.cpf_cnpj)
  const extras = (cfg.clausulas_extras ?? '').split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean)
  let n = 0
  const cl = (t: string) => `<p>${b(`CLÁUSULA ${++n}ª – ${t}.`)} `
  const local = esc((cfg.cidade || '________________') + ', ' + dataExtenso(dataIso) + '.')
  const sig = (papel: PapelAssinatura, nome: string, rotulo: string, doc: string) =>
    `<div><!--ASS:${papel}--><div class="ln">${esc(nome)}<br>${rotulo}${doc ? ' – ' + esc(doc) : ''}</div></div>`
  const tabela = `<table><tr><th>Qtd.</th><th>Descrição</th><th class="r">Valor</th></tr>${d.itens
    .map((i) => {
      const x = doItem(i)
      return `<tr><td>${i.quantidade}</td><td>${esc(i.nome)}${x?.dimensoes ? ' (' + esc(x.dimensoes) + ')' : ''}</td><td class="r">${brl(i.quantidade * Number(i.valor))}</td></tr>`
    })
    .join('')}</table>`
  // < > & e - viram \uXXXX: o JSON continua válido e nada nele fecha o comentário
  const cabecalho = `<!--PARTES ${JSON.stringify(partes).replace(/[<>&-]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))}-->`

  return (
    cabecalho +
    `<div class="doc">
<h1>CONTRATO DE LOCAÇÃO DE BRINQUEDOS</h1><p class="sub">Contrato nº ${num}</p>
<p>${b('LOCADOR:')} ${esc(cfg.nome)}, inscrito(a) no CPF/CNPJ sob o nº ${esc(docLocador)}, com endereço em ${L(cfg.endereco)}${cfg.telefone ? ', telefone ' + esc(fTel(cfg.telefone)) : ''}.</p>
<p>${b('LOCATÁRIO:')} ${esc(c.nome)}, inscrito(a) no CPF sob o nº ${esc(fCPF(c.cpf))}${c.rg ? ', RG ' + esc(c.rg) : ''}, residente em ${esc(enderecoCliente(c))}${c.telefone ? ', telefone ' + esc(fTel(c.telefone)) : ''}${c.email ? ', e-mail ' + esc(c.email) : ''}.</p>
<p>As partes acima identificadas celebram o presente contrato de locação de bens móveis, regido pelos arts. 565 a 578 do Código Civil e, no que couber, pela Lei nº 8.078/1990 (Código de Defesa do Consumidor), mediante as cláusulas a seguir.</p>
${cl('DO OBJETO')}O LOCADOR cede ao LOCATÁRIO, por tempo determinado, o uso e gozo dos seguintes bens:</p>${tabela}
${cl('DO PRAZO, DA ENTREGA E DA RETIRADA')}A locação vigora de ${fData(l.data_inicio)} a ${fData(l.data_fim)}, com entrega e montagem previstas para as ${hm(l.hora_entrega)} de ${fData(l.data_inicio)} e retirada às ${hm(l.hora_retirada)} de ${fData(l.data_fim)}, no seguinte endereço: ${esc(l.endereco_evento)}.</p>
<p>${b('Parágrafo único.')} O LOCATÁRIO garantirá acesso ao local e espaço plano, limpo e desobstruído, compatível com as dimensões dos bens${energia.length ? `, bem como ponto de energia elétrica em ${esc(energia.join(' ou '))} próximo ao local de montagem` : ''}.</p>
${cl('DO PREÇO E DO PAGAMENTO')}Pela locação, o LOCATÁRIO pagará o valor total de ${b(brl(tot))} (${extenso(tot)}), correspondente a ${brl(sub)} pelos bens${numv(l.frete) ? `, acrescido de ${brl(l.frete)} de taxa de entrega` : ''}${numv(l.desconto) ? `, deduzido desconto de ${brl(l.desconto)}` : ''}, mediante ${esc(l.forma_pagamento ?? '')}${l.condicoes ? `, nas seguintes condições: ${esc(l.condicoes)}` : ''}${cfg.chave_pix && l.forma_pagamento === 'Pix' ? `, chave Pix ${esc(cfg.chave_pix)}` : ''}.</p>
${numv(l.caucao) ? `<p>${b('Parágrafo único.')} A título de garantia, o LOCATÁRIO entrega caução de ${brl(l.caucao)} (${extenso(Number(l.caucao))}), a ser restituída na retirada dos bens, deduzidos os valores eventualmente devidos na forma deste contrato.</p>` : ''}
${cl('DAS OBRIGAÇÕES DO LOCADOR')}Compete ao LOCADOR: I – entregar os bens em perfeitas condições de uso, segurança e higiene; II – realizar a montagem, a fixação e a desmontagem; III – orientar o responsável indicado sobre as regras de uso; IV – reparar ou substituir, sem ônus, o bem que apresentar defeito não causado pelo LOCATÁRIO (art. 566, I, do Código Civil).</p>
${cl('DAS OBRIGAÇÕES DO LOCATÁRIO')}Compete ao LOCATÁRIO (art. 569 do Código Civil): I – utilizar os bens exclusivamente no endereço e para a finalidade contratados, vedadas a cessão e a sublocação; II – manter supervisão permanente de adulto responsável durante todo o uso, nos termos do Termo de Responsabilidade anexo, que integra este contrato; III – não mover, desmontar ou alterar a instalação dos bens; IV – pagar pontualmente o preço; V – restituir os bens no estado em que os recebeu, salvo o desgaste natural do uso regular; VI – ressarcir os danos causados aos bens por uso inadequado, negligência ou ato de terceiros sob sua responsabilidade, apurados em vistoria na retirada.</p>
${cl('DAS CONDIÇÕES CLIMÁTICAS E DE SEGURANÇA')}Em caso de chuva, vento forte ou outra condição que comprometa a segurança, o uso dos bens deverá ser imediatamente interrompido, podendo o LOCADOR ou seu preposto suspender o funcionamento, sem que isso configure descumprimento contratual por qualquer das partes.</p>
${cl('DA RETIRADA')}Impedida a retirada no horário ajustado por fato atribuível ao LOCATÁRIO, este pagará o aluguel proporcional ao período excedente${numv(cfg.taxa_visita) ? ` e a taxa de nova visita de ${brl(cfg.taxa_visita)}` : ' e os custos de novo deslocamento'}, respondendo ainda pelos danos que os bens vierem a sofrer nesse período (art. 575 do Código Civil).</p>
${cl('DO CANCELAMENTO')}O cancelamento pelo LOCATÁRIO com antecedência mínima de ${cfg.canc_dias} dias da data da entrega dará direito à restituição integral dos valores pagos; em prazo inferior, o LOCADOR poderá reter até ${cfg.canc_pct}% do valor total, a título de compensação pela reserva da data. Fica ressalvado o direito de arrependimento do art. 49 do Código de Defesa do Consumidor quando a contratação ocorrer fora do estabelecimento comercial.</p>
${cl('DOS DADOS PESSOAIS')}Os dados pessoais do LOCATÁRIO e do responsável indicado serão tratados exclusivamente para a execução deste contrato e o cumprimento de obrigações legais, nos termos da Lei nº 13.709/2018 (LGPD).</p>
${extras.map((t) => `${cl('DISPOSIÇÃO ADICIONAL')}${esc(t)}</p>`).join('\n')}
${cl('DO FORO')}Fica eleito o foro da comarca de ${L(cfg.comarca_foro)} para dirimir as questões oriundas deste contrato, ressalvado ao LOCATÁRIO consumidor o direito de demandar no foro de seu domicílio (art. 101, I, do Código de Defesa do Consumidor).</p>
<p>E, por estarem assim justas e contratadas, as partes assinam o presente instrumento.</p>
<p class="dir">${local}</p>
<div class="sigs">${sig('locador', cfg.nome, 'LOCADOR', docLocador)}${sig('locatario', c.nome, 'LOCATÁRIO', fCPF(c.cpf))}<div><div class="sp"></div><div class="ln">Testemunha 1 – CPF</div></div><div><div class="sp"></div><div class="ln">Testemunha 2 – CPF</div></div></div>

<div class="pb"><h1>TERMO DE RESPONSABILIDADE E CIÊNCIA DAS REGRAS DE USO</h1><p class="sub">Anexo ao Contrato nº ${num}</p>
<p>Eu, ${b(resp.nome)}, inscrito(a) no CPF sob o nº ${esc(fCPF(resp.cpf))}${telResp ? ', telefone ' + esc(fTel(telResp)) : ''}, na qualidade de responsável pela supervisão dos brinquedos e das crianças durante o evento realizado em ${esc(l.endereco_evento)}, entre ${fData(l.data_inicio)} e ${fData(l.data_fim)}, declaro que:</p>
<ol>
<li>recebi os bens relacionados abaixo montados e fixados pelo LOCADOR, em bom estado de conservação, funcionamento e limpeza, e fui orientado(a) sobre as regras de uso;</li>
<li>manterei supervisão contínua de adulto durante todo o período de funcionamento, sem deixar crianças desacompanhadas nos brinquedos;</li>
<li>farei respeitar a capacidade máxima de usuários simultâneos e a faixa etária indicadas para cada brinquedo, evitando o uso conjunto por crianças de portes muito diferentes;</li>
<li>não permitirei o uso com calçados, óculos, bijuterias ou objetos pontiagudos, nem com alimentos, bebidas ou goma de mascar, tampouco cambalhotas, empurrões ou o uso por adultos;</li>
<li>interromperei imediatamente o uso em caso de chuva, vento forte, perda de pressão do inflável ou qualquer anormalidade, comunicando o LOCADOR${cfg.telefone ? ' pelo telefone ' + esc(fTel(cfg.telefone)) : ''};</li>
<li>não desligarei o soprador nem removerei ancoragens com crianças no brinquedo, e manterei cabos e extensões fora do alcance delas;</li>
<li>responsabilizo-me pelos danos causados aos bens por mau uso, negligência ou vandalismo, apurados em vistoria na retirada.</li>
</ol>
<table><tr><th>Brinquedo</th><th>Faixa etária</th><th>Capacidade</th></tr>${d.itens
      .map((i) => {
        const x = doItem(i)
        return `<tr><td>${i.quantidade}× ${esc(i.nome)}</td><td>${esc(x?.faixa_etaria || '—')}</td><td>${x?.capacidade ? esc(x.capacidade) + ' crianças' : '—'}</td></tr>`
      })
      .join('')}</table>
${regras.length ? `<p>${b('Regras específicas:')}</p>${regras.map((x) => `<p>${b(x.nome + ':')} ${esc(x.regras)}</p>`).join('')}` : ''}
<p>O presente termo disciplina os deveres de vigilância e de uso durante o evento, sem prejuízo das obrigações legais de cada parte.</p>
<p class="dir">${local}</p>
<div class="sigs">${sig(papelResp, resp.nome, 'RESPONSÁVEL', fCPF(resp.cpf))}${sig('locador', cfg.nome, 'LOCADOR', docLocador)}</div></div></div>`
  )
}

export interface AssinaturaExibida {
  papel: PapelAssinatura
  imagem_png: string
  assinado_em: string
}

const CSS_DOC = `
body{margin:0;padding:24px 16px;background:#fff;color:#111}
.doc{max-width:760px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.62}
.doc h1{font-size:16px;text-align:center;margin:0 0 2px;letter-spacing:.03em}
.doc .sub{text-align:center;margin:0 0 18px;font-size:13px}
.doc p{margin:0 0 10px;text-align:justify}
.doc p.dir{text-align:right}
.doc table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:13px}
.doc th,.doc td{border:1px solid #999;padding:4px 7px;text-align:left}
.doc td.r,.doc th.r{text-align:right;white-space:nowrap}
.doc ol{padding-left:22px;margin:0 0 10px}
.doc li{margin-bottom:6px;text-align:justify}
.falta{color:#b00}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:26px 24px;margin-top:30px}
.sigs>div{text-align:center;font-size:12.5px;line-height:1.35}
.sigs .ln{border-top:1px solid #111;padding-top:4px;margin-top:2px}
.sigs img{height:62px;max-width:100%;display:block;margin:0 auto -4px;object-fit:contain}
.sigs .sp{height:58px}
.sigs em{display:block;font-size:10.5px;color:#555;font-style:normal}
.pb{margin-top:36px;border-top:1px dashed #bbb;padding-top:28px}
.aviso{max-width:760px;margin:0 auto 16px;font-family:system-ui,sans-serif;font-size:13px;background:#FFF1C7;border-radius:8px;padding:10px 12px}
@media print{body{padding:0}.pb{border:0;margin:0;padding:0;break-before:page}.aviso{display:none}@page{margin:18mm 16mm}}
`

const fDataHoraSP = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/** Página HTML completa do documento, com as assinaturas colhidas nos lugares marcados. */
export function paginaDocumento(html: string, assinaturas: AssinaturaExibida[], titulo: string, aviso?: string): string {
  const porPapel = new Map(assinaturas.map((a) => [a.papel, a]))
  const corpo = html.replace(/<!--PARTES .*?-->/, '').replace(/<!--ASS:(locatario|responsavel|locador)-->/g, (_, p: PapelAssinatura) => {
    const a = porPapel.get(p)
    if (!a || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.imagem_png)) return '<div class="sp"></div>'
    return `<img src="${a.imagem_png}" alt="Assinatura"><em class="quando">Assinado na tela em ${esc(fDataHoraSP(a.assinado_em))}</em>`
  })
  // A data da assinatura aparece abaixo da linha, junto do nome
  const final = corpo.replace(/(<img src="data:image\/png[^>]*>)(<em class="quando">.*?<\/em>)(<div class="ln">.*?)(<\/div><\/div>)/g, '$1$3$2$4')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title><style>${CSS_DOC}</style></head><body>${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ''}${final}</body></html>`
}
