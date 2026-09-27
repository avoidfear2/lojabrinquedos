import { describe, expect, it } from 'vitest'
import { cnpjOk, cpfOk, datas, fDoc, fTel, numv, somaMes } from '@/lib/dominio/formato'
import { conflitos, enderecoCliente, livresNoPeriodo, numeroContrato, total, type Reserva } from '@/lib/dominio/locacao'
import { traduzErro } from '@/lib/erros'
import { abas, pode } from '@/lib/permissoes'

describe('formato', () => {
  it('lê valores em reais', () => {
    expect(numv('1.234,56')).toBe(1234.56)
    expect(numv('R$ 250')).toBe(250)
    expect(numv('')).toBe(0)
  })
  it('valida CPF e CNPJ', () => {
    expect(cpfOk('529.982.247-25')).toBe(true)
    expect(cpfOk('111.111.111-11')).toBe(false)
    expect(cnpjOk('11.222.333/0001-81')).toBe(true)
    expect(cnpjOk('11.222.333/0001-80')).toBe(false)
  })
  it('máscaras', () => {
    expect(fDoc('11222333000181')).toBe('11.222.333/0001-81')
    expect(fTel('41999998888')).toBe('(41) 99999-8888')
  })
  it('datas e meses', () => {
    expect(datas('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(somaMes('2026-12', 1)).toBe('2027-01')
    expect(somaMes('2026-01', -1)).toBe('2025-12')
  })
})

describe('locação', () => {
  const R: Reserva[] = [
    { locacao_id: 'a', data_inicio: '2026-10-10', data_fim: '2026-10-10', brinquedo_id: 'pula', quantidade: 1 },
    { locacao_id: 'b', data_inicio: '2026-10-09', data_fim: '2026-10-11', brinquedo_id: 'pula', quantidade: 1 },
  ]
  it('calcula unidades livres no período (pior dia)', () => {
    expect(livresNoPeriodo(3, R, 'pula', '2026-10-08', '2026-10-12')).toBe(1)
    expect(livresNoPeriodo(3, R, 'pula', '2026-10-12', '2026-10-12')).toBe(3)
    expect(livresNoPeriodo(2, R, 'pula', '2026-10-10', '2026-10-10', 'a')).toBe(1)
  })
  it('lista conflitos', () => {
    const c = conflitos([{ brinquedo_id: 'pula', nome: 'Pula-pula', quantidade: 1, estoque: 2 }], R, '2026-10-10', '2026-10-10')
    expect(c).toEqual(['Pula-pula em 10/10/2026: 0 livre(s), pedido 1'])
  })
  it('total e número do contrato', () => {
    expect(total({ frete: 50, desconto: 20, itens: [{ quantidade: 2, valor: 100 }] })).toBe(230)
    expect(numeroContrato(7, '2026-10-10')).toBe('0007/2026')
  })
  it('endereço do cliente', () => {
    expect(enderecoCliente({ rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' })).toBe('Rua A, 10, Centro, Curitiba/PR')
  })
})

describe('permissões', () => {
  it('entregador não vê caixa, clientes nem cadastros', () => {
    expect(abas('entregador').map((a) => a.rotulo)).toEqual(['Início', 'Agenda', 'Locações'])
    expect(pode.verValores('entregador')).toBe(false)
    expect(abas('operador')).toHaveLength(5)
    expect(pode.gerenciarEquipe('operador')).toBe(false)
  })
})

describe('erros', () => {
  it('repassa mensagens do banco e traduz códigos', () => {
    expect(traduzErro({ code: 'P0001', message: 'Sem disponibilidade: Pula em 10/10/2026 (2 reservado(s) para 1 unidade(s)).' })).toMatch(/^Sem disponibilidade/)
    expect(traduzErro({ code: '42501', message: 'new row violates row-level security policy' }, false)).toMatch(/somente leitura/)
    expect(traduzErro({ code: '23505', message: 'duplicate key value violates unique constraint "clientes_locadora_id_cpf_key"' })).toBe('Já existe um cliente com este CPF.')
  })
})
