'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface QuadroAssinaturaRef {
  limpar: () => void
  vazio: () => boolean
  /** PNG com 600 px de largura e fundo transparente. */
  png: () => string
}

/** Área para assinar com o dedo (ou mouse). Portado do protótipo. */
export const QuadroAssinatura = forwardRef<QuadroAssinaturaRef>(function QuadroAssinatura(_, ref) {
  const cv = useRef<HTMLCanvasElement>(null)
  const sujo = useRef(false)

  useEffect(() => {
    const c = cv.current!
    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
    let desenhando = false
    const pt = (e: PointerEvent) => {
      const b = c.getBoundingClientRect()
      return [e.clientX - b.left, e.clientY - b.top] as const
    }
    const down = (e: PointerEvent) => {
      desenhando = true
      c.setPointerCapture(e.pointerId)
      const [x, y] = pt(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 0.1, y + 0.1)
      ctx.stroke()
      sujo.current = true
    }
    const move = (e: PointerEvent) => {
      if (!desenhando) return
      const [x, y] = pt(e)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    const up = () => (desenhando = false)
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    limpar() {
      const c = cv.current!
      const ctx = c.getContext('2d')!
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.restore()
      sujo.current = false
    },
    vazio: () => !sujo.current,
    png() {
      const c = cv.current!
      const o = document.createElement('canvas')
      o.width = 600
      o.height = Math.round((600 * c.height) / c.width)
      o.getContext('2d')!.drawImage(c, 0, 0, o.width, o.height)
      return o.toDataURL('image/png')
    },
  }))

  return <canvas ref={cv} className="pad" aria-label="Área de assinatura" />
})
