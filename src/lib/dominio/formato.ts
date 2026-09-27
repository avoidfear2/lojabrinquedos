// Formatação e validação (portado do protótipo)

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const DOWL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export const brl = (n: number | string | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const nfmt = (n: number | string | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Lê valores digitados como "1.234,56", "R$ 250" ou "250.5". */
export function numv(v: unknown): number {
  let s = String(v ?? '').trim().replace(/[R$\s]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
export const toD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (iso: string, n: number) => {
  const d = toD(iso)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}
export const fData = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
export const dow = (iso?: string | null) => (iso ? DOW[toD(iso).getDay()] : '')
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const hm = (t?: string | null) => (t ? t.slice(0, 5) : '')

/** Data de hoje no fuso da locadora (Brasília), igual no servidor e no aparelho. */
export function hoje(tz = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Lista de dias ISO entre a e b (inclusive), no máximo 62. */
export function datas(a: string, b: string): string[] {
  const r: string[] = []
  let x = a
  let g = 0
  while (x <= b && g < 62) {
    r.push(x)
    x = addDays(x, 1)
    g++
  }
  return r
}

export const mesValido = (m?: string | null) => (m && /^\d{4}-\d{2}$/.test(m) ? m : null)
export const diaValido = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)
export function somaMes(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number)
  return isoOf(new Date(y, m - 1 + n, 1)).slice(0, 7)
}
export function fimDoMes(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  return isoOf(new Date(y, m, 0))
}

export const onlyDig = (s: unknown) => String(s ?? '').replace(/\D/g, '')

export function cpfOk(v: unknown): boolean {
  const c = onlyDig(v)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i)
  let r = (s * 10) % 11
  if (r === 10) r = 0
  if (r !== +c[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i)
  r = (s * 10) % 11
  if (r === 10) r = 0
  return r === +c[10]
}

export function cnpjOk(v: unknown): boolean {
  const c = onlyDig(v)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const calc = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((a, p, i) => a + p * +c[i], 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === +c[12] && calc(13) === +c[13]
}

export const docOk = (v: unknown) => (onlyDig(v).length === 11 ? cpfOk(v) : cnpjOk(v))

export const fCPF = (v: unknown) =>
  onlyDig(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
export function fDoc(v: unknown) {
  const c = onlyDig(v).slice(0, 14)
  if (c.length <= 11) return fCPF(c)
  return c
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
export function fTel(v: unknown) {
  const c = onlyDig(v).slice(0, 11)
  if (c.length <= 10) return c.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return c.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3')
}
export const fCEP = (v: unknown) => onlyDig(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')

export const MASCARAS = { cpf: fCPF, doc: fDoc, tel: fTel, cep: fCEP } as const
export type Mascara = keyof typeof MASCARAS

/** Data e hora no fuso de Brasília (igual no servidor e no aparelho). */
export const fDataHora = (iso: string, tz = 'America/Sao_Paulo') =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: tz })
