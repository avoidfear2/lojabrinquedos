'use client'

import { useEffect, useRef, useState } from 'react'
import { supabaseNavegador } from '@/lib/supabase/browser'
import type { VistoriaFase } from '@/lib/tipos'

interface Foto {
  chave: string
  preview: string
  caminho?: string
  estado: 'enviando' | 'ok' | 'erro'
}

const MAX_FOTOS = 20
const LADO_MAX = 1600

/** Reduz a foto no próprio aparelho (JPEG, até 1600 px) antes de enviar. */
async function reduzir(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = erro
      i.src = url
    })
    const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * escala)
    c.height = Math.round(img.naturalHeight * escala)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error('falha ao gerar JPEG'))), 'image/jpeg', 0.8))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Fotos da vistoria: cada foto é enviada ao Storage assim que escolhida,
 * no caminho <locadora>/<locação>/<fase>/<id>.jpg (regras na migração 003).
 */
export function FotosVistoria({
  locadoraId,
  locacaoId,
  fase,
  onMudar,
}: {
  locadoraId: string
  locacaoId: string
  fase: VistoriaFase
  onMudar: (estado: { caminhos: string[]; enviando: boolean }) => void
}) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onMudar({ caminhos: fotos.filter((f) => f.estado === 'ok').map((f) => f.caminho!), enviando: fotos.some((f) => f.estado === 'enviando') })
  }, [fotos, onMudar])

  async function adicionar(lista: FileList | null) {
    if (!lista) return
    const arquivos = [...lista].slice(0, MAX_FOTOS - fotos.length)
    for (const arq of arquivos) {
      const chave = crypto.randomUUID()
      setFotos((fs) => [...fs, { chave, preview: URL.createObjectURL(arq), estado: 'enviando' }])
      try {
        const blob = await reduzir(arq)
        const caminho = `${locadoraId}/${locacaoId}/${fase}/${chave}.jpg`
        const { error } = await supabaseNavegador().storage.from('vistorias').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false })
        if (error) throw error
        setFotos((fs) => fs.map((f) => (f.chave === chave ? { ...f, caminho, estado: 'ok' } : f)))
      } catch {
        setFotos((fs) => fs.map((f) => (f.chave === chave ? { ...f, estado: 'erro' } : f)))
      }
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div className="fotos-campo">
      <span className="f-rot">Fotos {fotos.length > 0 && `(${fotos.length})`}</span>
      {fotos.length > 0 && (
        <div className="fotos">
          {fotos.map((f) => (
            <div key={f.chave} className={'foto ' + f.estado}>
              <img src={f.preview} alt="" />
              {f.estado === 'enviando' && <span className="selo">Enviando…</span>}
              {f.estado === 'erro' && <span className="selo erro">Falhou</span>}
              <button type="button" className="tirar" aria-label="Tirar esta foto da vistoria" onClick={() => setFotos((fs) => fs.filter((x) => x.chave !== f.chave))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {fotos.length < MAX_FOTOS && (
        <label className="btn ghost sm">
          Adicionar fotos
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => adicionar(e.target.files)}
          />
        </label>
      )}
      {fotos.some((f) => f.estado === 'erro') && <small className="due">Alguma foto não foi enviada. Tire de novo ou remova antes de confirmar.</small>}
    </div>
  )
}
