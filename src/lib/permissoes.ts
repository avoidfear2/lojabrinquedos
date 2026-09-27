import type { Papel } from './tipos'

/**
 * O que cada papel vê na interface. A regra de verdade está na RLS do banco;
 * isto só evita mostrar botões e telas que o banco recusaria.
 */
export const pode = {
  verValores: (p: Papel) => p !== 'entregador',
  verClientes: (p: Papel) => p !== 'entregador',
  verCaixa: (p: Papel) => p !== 'entregador',
  editarCadastros: (p: Papel) => p !== 'entregador',
  editarLocacoes: (p: Papel) => p !== 'entregador',
  registrarVistoria: (_p: Papel) => true,
  editarLocadora: (p: Papel) => p === 'dono',
  gerenciarEquipe: (p: Papel) => p === 'dono',
}

export interface Aba {
  href: string
  rotulo: string
  icone: 'inicio' | 'agenda' | 'locacoes' | 'cadastros' | 'caixa'
}

export function abas(p: Papel): Aba[] {
  const todas: Aba[] = [
    { href: '/inicio', rotulo: 'Início', icone: 'inicio' },
    { href: '/agenda', rotulo: 'Agenda', icone: 'agenda' },
    { href: '/locacoes', rotulo: 'Locações', icone: 'locacoes' },
  ]
  if (pode.editarCadastros(p)) todas.push({ href: '/cadastros/brinquedos', rotulo: 'Cadastros', icone: 'cadastros' })
  if (pode.verCaixa(p)) todas.push({ href: '/caixa', rotulo: 'Caixa', icone: 'caixa' })
  return todas
}
