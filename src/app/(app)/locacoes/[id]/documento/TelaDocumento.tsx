'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { QuadroAssinatura, type QuadroAssinaturaRef } from '@/components/QuadroAssinatura'
import { Erro, Folha } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { assinarDocumento } from '@/lib/acoes/documentos'
import type { PapelAssinatura } from '@/lib/documentos/modelo'

const ROTULO: Record<PapelAssinatura, string> = { locatario: 'Locatário', responsavel: 'Responsável no local', locador: 'Locador' }

interface Props {
  locacaoId: string
  titulo: string
  existe: boolean
  escritorio: boolean
  faltaAjustes: string[]
  mudou: boolean
  partes: { papel: PapelAssinatura; nome: string; assinadoEm: string | null }[]
  versao: string
}

export function TelaDocumento({ locacaoId, titulo, existe, escritorio, faltaAjustes, mudou, partes, versao }: Props) {
  const [assinando, setAssinando] = useState<PapelAssinatura | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const src = `/locacoes/${locacaoId}/documento/arquivo?v=${versao}`

  if (!existe) {
    return (
      <>
        <h1 className="hello">{titulo}</h1>
        <p className="empty">O contrato desta locação ainda não foi gerado. Ele fica pronto quando o escritório confirma a locação.</p>
      </>
    )
  }

  // Só dono e operador assinam pelo locador; o entregador colhe locatário e responsável
  const visiveis = partes.filter((p) => escritorio || p.papel !== 'locador')

  return (
    <>
      <h1 className="hello">{titulo}</h1>
      {faltaAjustes.length > 0 && (
        <div className="note">
          Para o contrato sair completo, preencha em <Link href="/ajustes">Ajustes</Link>: {faltaAjustes.join(', ')}.
        </div>
      )}
      {mudou && <div className="note">A locação mudou depois das assinaturas. As assinaturas continuam guardadas na versão anterior; colha de novo nesta versão.</div>}

      <div className="assin-lista">
        {visiveis.map((p) => (
          <div key={p.papel} className="row">
            <div>
              <strong>{ROTULO[p.papel]}</strong>
              <small>{p.nome}</small>
            </div>
            {p.assinadoEm ? (
              <span className="paid">Assinado em {p.assinadoEm}</span>
            ) : (
              <button className="btn yellow sm" onClick={() => setAssinando(p.papel)}>Assinar</button>
            )}
          </div>
        ))}
      </div>

      <div className="docbar">
        <a className="btn primary" href={src} target="_blank" rel="noopener">Abrir para imprimir ou salvar PDF</a>
      </div>

      <iframe
        ref={frame}
        key={src}
        className="docframe"
        src={src}
        title="Contrato"
        onLoad={() => {
          const f = frame.current
          const h = f?.contentDocument?.documentElement.scrollHeight
          if (f && h) f.style.height = h + 20 + 'px'
        }}
      />

      <Folha titulo={assinando ? `Assinatura: ${ROTULO[assinando]}` : ''} aberta={!!assinando} onFechar={() => setAssinando(null)}>
        {assinando && (
          <FormAssinatura
            locacaoId={locacaoId}
            papel={assinando}
            nome={partes.find((p) => p.papel === assinando)?.nome ?? ''}
            onFim={() => setAssinando(null)}
          />
        )}
      </Folha>
    </>
  )
}

function FormAssinatura({ locacaoId, papel, nome, onFim }: { locacaoId: string; papel: PapelAssinatura; nome: string; onFim: () => void }) {
  const quadro = useRef<QuadroAssinaturaRef>(null)
  const { executar, erro, setErro, pendente } = useAcao()
  const onde =
    papel === 'responsavel' ? 'no termo de responsabilidade' : papel === 'locatario' ? 'no contrato (e no termo, se for o responsável no local)' : 'no contrato e no termo'
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {nome} – assine com o dedo dentro do quadro. A assinatura entra {onde} e não pode ser alterada depois.
      </p>
      <QuadroAssinatura ref={quadro} />
      <Erro msg={erro} />
      <div className="acts">
        <button type="button" className="btn ghost" onClick={() => quadro.current?.limpar()}>Limpar</button>
        <button
          type="button"
          className="btn primary"
          disabled={pendente}
          onClick={() => {
            if (!quadro.current || quadro.current.vazio()) return setErro('Assine dentro do quadro antes de salvar.')
            const png = quadro.current.png()
            executar(() => assinarDocumento(locacaoId, papel, png), onFim)
          }}
        >
          {pendente ? 'Salvando…' : 'Salvar assinatura'}
        </button>
      </div>
    </>
  )
}
