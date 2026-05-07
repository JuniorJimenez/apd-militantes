// components/Toast.tsx
'use client'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
  id:      number
  message: string
  type:    ToastType
}

interface ToastProps {
  toasts:   ToastData[]
  onRemove: (id: number) => void
}

const ICONS: Record<ToastType, JSX.Element> = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
    </svg>
  ),
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-white border-l-4 border-l-green-500 text-gray-800',
  error:   'bg-white border-l-4 border-l-[#C8001E] text-gray-800',
  warning: 'bg-white border-l-4 border-l-amber-500 text-gray-800',
  info:    'bg-white border-l-4 border-l-[#0D3B8C] text-gray-800',
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-600',
  error:   'text-[#C8001E]',
  warning: 'text-amber-600',
  info:    'text-[#0D3B8C]',
}

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Entrada
    const t1 = setTimeout(() => setVisible(true), 10)
    // Salida automática a los 4s
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [toast.id, onRemove])

  return (
    <div
      className={`
        ${STYLES[toast.type]}
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
        border border-gray-100 min-w-[280px] max-w-[380px]
        transition-all duration-300 ease-out cursor-pointer
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      onClick={() => {
        setVisible(false)
        setTimeout(() => onRemove(toast.id), 300)
      }}
    >
      <span className={ICON_COLORS[toast.type]}>{ICONS[toast.type]}</span>
      <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
      <button
        className="text-gray-400 hover:text-gray-600 transition-colors ml-1 flex-shrink-0"
        onClick={e => { e.stopPropagation(); setVisible(false); setTimeout(() => onRemove(toast.id), 300) }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Contenedor de toasts (abajo al centro) ───────────────────────────────────
export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ─── Hook para usar toasts fácilmente ────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])
  let counter = 0

  const show = (message: string, type: ToastType = 'success') => {
    const id = Date.now() + counter++
    setToasts(prev => [...prev, { id, message, type }])
  }

  const remove = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, show, remove }
}
