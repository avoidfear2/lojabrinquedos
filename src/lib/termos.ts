import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { TERMOS_VERSAO } from './dominio/constantes'

export interface BlocoTermos {
  tipo: 'h1' | 'h2' | 'p' | 'li'
  texto: string
}

/** Lê conteudo/termos-<versão>.md e converte um markdown simples (títulos, parágrafos, listas). */
export async function lerTermos(versao = TERMOS_VERSAO) {
  const bruto = await readFile(path.join(process.cwd(), 'conteudo', `termos-v${versao}.md`), 'utf8').catch(() => '')
  const pendente = !bruto || bruto.includes('<!-- PENDENTE')
  const semComentarios = bruto.replace(/<!--[\s\S]*?-->/g, '')
  const blocos: BlocoTermos[] = []
  for (const par of semComentarios.split(/\n\s*\n/)) {
    const t = par.trim()
    if (!t) continue
    if (t.startsWith('# ')) blocos.push({ tipo: 'h1', texto: t.slice(2).trim() })
    else if (t.startsWith('## ')) blocos.push({ tipo: 'h2', texto: t.slice(3).trim() })
    else if (/^[-*] /m.test(t)) t.split('\n').forEach((l) => blocos.push({ tipo: 'li', texto: l.replace(/^[-*]\s+/, '').trim() }))
    else blocos.push({ tipo: 'p', texto: t.replace(/\s*\n\s*/g, ' ') })
  }
  return { versao, pendente, blocos }
}
