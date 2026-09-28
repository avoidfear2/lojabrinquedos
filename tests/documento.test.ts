import { describe, expect, it } from 'vitest'
import { extenso, faltandoNoLocador, gerarDocumento, paginaDocumento, partesDoDocumento, partesGravadas, type DadosDocumento } from '@/lib/documentos/modelo'

const dados: DadosDocumento = {
  locadora: { nome: 'Pula Alegria', cpf_cnpj: '11222333000181', telefone: '41999998888', endereco: 'Rua A, 1', cidade: 'Curitiba/PR', comarca_foro: 'Curitiba/PR', chave_pix: 'pix@pula', canc_dias: 7, canc_pct: 30, taxa_visita: 0, clausulas_extras: null },
  cliente: { nome: 'Maria <b>Silva</b>', cpf: '52998224725', rg: null, telefone: '41988887777', email: null, rua: 'Rua B', numero: '2', complemento: null, bairro: 'Centro', cidade: 'Curitiba', uf: 'PR', cep: null },
  locacao: { numero: 7, data_inicio: '2026-10-10', data_fim: '2026-10-10', hora_entrega: '09:00:00', hora_retirada: '18:00:00', endereco_evento: 'Rua B, 2', resp_nome: 'Maria Silva', resp_cpf: '52998224725', resp_telefone: '41988887777', frete: 50, desconto: 0, caucao: 0, forma_pagamento: 'Pix', condicoes: null },
  itens: [{ brinquedo_id: 'b1', nome: 'Pula-pula 3x3', quantidade: 1, valor: 250 }],
  brinquedos: [{ id: 'b1', dimensoes: '3 x 3 m', faixa_etaria: '3 a 10 anos', capacidade: 5, energia: '220 V', regras: 'Sem sapatos.' }],
}

describe('contrato', () => {
  const html = gerarDocumento(dados, '2026-09-28').replace(/\u00a0/g, ' ')

  it('traz o locador como parte e nunca a plataforma', () => {
    expect(html).toContain('<b>LOCADOR:</b> Pula Alegria')
    expect(html).toContain('Contrato nº 0007/2026')
    expect(html).toContain('R$ 300,00</b> (trezentos reais)')
    expect(html).toContain('chave Pix pix@pula')
    expect(html).toContain('Curitiba/PR, 28 de setembro de 2026.')
    expect(html.toLowerCase()).not.toContain('plataforma')
  })
  it('escapa dados digitados', () => {
    expect(html).toContain('Maria &lt;b&gt;Silva&lt;/b&gt;')
    expect(html).not.toContain('<b>Silva</b>')
  })
  it('é determinístico (mesmos dados e data, mesmo texto)', () => {
    expect(gerarDocumento(dados, '2026-09-28').replace(/\u00a0/g, ' ')).toBe(html)
  })
  it('marca os lugares de assinatura; responsável = locatário quando é o próprio cliente', () => {
    expect(html.match(/<!--ASS:locatario-->/g)).toHaveLength(2)
    expect(html.match(/<!--ASS:locador-->/g)).toHaveLength(2)
    expect(html).not.toContain('<!--ASS:responsavel-->')
    const outro = gerarDocumento({ ...dados, locacao: { ...dados.locacao, resp_nome: 'João', resp_cpf: '11144477735' } }, '2026-09-28')
    expect(outro).toContain('<!--ASS:responsavel-->')
    expect(partesGravadas(outro).responsavel).toEqual({ nome: 'João', cpf: '11144477735' })
  })
  it('lê as partes gravadas no cabeçalho', () => {
    expect(partesGravadas(html)).toEqual(partesDoDocumento(dados))
  })
  it('monta a página com as assinaturas e ignora imagem que não seja PNG em base64', () => {
    const p = paginaDocumento(html, [
      { papel: 'locatario', imagem_png: 'data:image/png;base64,AAAA', assinado_em: '2026-09-28T15:00:00Z' },
      { papel: 'locador', imagem_png: 'javascript:alert(1)', assinado_em: '2026-09-28T15:00:00Z' },
    ], 'Contrato')
    expect(p.match(/<img src="data:image\/png;base64,AAAA"/g)).toHaveLength(2)
    expect(p).toContain('Assinado na tela em 28/09/2026, 12:00')
    expect(p).not.toContain('javascript:')
    expect(p).not.toContain('<!--PARTES')
  })
  it('valores por extenso e dados faltando', () => {
    expect(extenso(1250.5)).toBe('mil duzentos e cinquenta reais e cinquenta centavos')
    expect(faltandoNoLocador({ ...dados.locadora, comarca_foro: null })).toEqual(['comarca do foro'])
  })
})
