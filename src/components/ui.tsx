'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MASCARAS, type Mascara } from '@/lib/dominio/formato'

/* ---------------- Campos ---------------- */

interface CampoProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue'> {
  rotulo: string
  name: string
  defaultValue?: string | number | null
  mascara?: Mascara
  obrigatorio?: boolean
}

export function Campo({ rotulo, mascara, obrigatorio, defaultValue, onChange, ...p }: CampoProps) {
  return (
    <label className="f">
      <span>
        {rotulo} {obrigatorio && <i aria-hidden="true">*</i>}
      </span>
      <input
        {...p}
        required={obrigatorio}
        defaultValue={defaultValue == null ? '' : mascara ? MASCARAS[mascara](defaultValue) : String(defaultValue)}
        onChange={(e) => {
          if (mascara) e.currentTarget.value = MASCARAS[mascara](e.currentTarget.value)
          e.currentTarget.setCustomValidity('')
          onChange?.(e)
        }}
      />
    </label>
  )
}

interface SelecaoProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue'> {
  rotulo: string
  name: string
  opcoes: (string | [string, string])[]
  defaultValue?: string | null
  vazio?: string
}

export function Selecao({ rotulo, opcoes, defaultValue, vazio, ...p }: SelecaoProps) {
  return (
    <label className="f">
      <span>{rotulo}</span>
      <select {...p} defaultValue={defaultValue ?? ''}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o]
          return (
            <option key={v} value={v}>
              {t}
            </option>
          )
        })}
      </select>
    </label>
  )
}

interface AreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'defaultValue'> {
  rotulo: string
  name: string
  defaultValue?: string | null
}

export function Area({ rotulo, defaultValue, ...p }: AreaProps) {
  return (
    <label className="f">
      <span>{rotulo}</span>
      <textarea {...p} defaultValue={defaultValue ?? ''} />
    </label>
  )
}

/* ---------------- Folha (modal de baixo para cima) ---------------- */

export function Folha({ titulo, aberta, onFechar, children }: { titulo: string; aberta: boolean; onFechar: () => void; children: React.ReactNode }) {
  const painel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    painel.current?.querySelector<HTMLElement>('input,select,textarea,button:not(.x)')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [aberta, onFechar])
  if (!aberta) return null
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="sheet-bg" onClick={onFechar} />
      <div className="panel" ref={painel}>
        <header>
          <h2>{titulo}</h2>
          <button type="button" className="x" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

/* ---------------- Aviso rápido (toast) ---------------- */

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('')
  const [on, setOn] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  const toast = useCallback((m: string) => {
    setMsg(m)
    setOn(true)
    clearTimeout(t.current)
    t.current = setTimeout(() => setOn(false), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast" role="status" aria-live="polite" className={on ? 'on' : ''}>
        {msg}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- Botão que pede um segundo toque ---------------- */

export function BotaoConfirmar({
  children,
  onConfirmar,
  className = 'btn ghost danger',
  disabled,
}: {
  children: React.ReactNode
  onConfirmar: () => void
  className?: string
  disabled?: boolean
}) {
  const [armado, setArmado] = useState(false)
  useEffect(() => {
    if (!armado) return
    const t = setTimeout(() => setArmado(false), 3500)
    return () => clearTimeout(t)
  }, [armado])
  return (
    <button
      type="button"
      disabled={disabled}
      className={className + (armado ? ' armed' : '')}
      onClick={() => {
        if (!armado) return setArmado(true)
        setArmado(false)
        onConfirmar()
      }}
    >
      {armado ? 'Toque de novo para confirmar' : children}
    </button>
  )
}

/* ---------------- Mensagem de erro de formulário ---------------- */

export function Erro({ msg }: { msg?: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (msg) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [msg])
  if (!msg) return null
  return (
    <div className="warn" role="alert" ref={ref} style={{ whiteSpace: 'pre-line' }}>
      {msg}
    </div>
  )
}
