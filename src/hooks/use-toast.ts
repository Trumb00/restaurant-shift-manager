'use client'

import * as React from 'react'

export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastAction =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'DISMISS_TOAST'; id: string }

interface ToastState {
  toasts: Toast[]
}

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return { toasts: [action.toast, ...state.toasts].slice(0, 5) }
    case 'REMOVE_TOAST':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'DISMISS_TOAST':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) }
    default:
      return state
  }
}

// Global listeners so toast() can be called outside of React tree
const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: ToastAction) {
  memoryState = toastReducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

let toastCount = 0

function toast(opts: Omit<Toast, 'id'>) {
  const id = String(++toastCount)
  const duration = opts.duration ?? 5000

  dispatch({ type: 'ADD_TOAST', toast: { ...opts, id } })

  if (duration > 0) {
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', id }), duration)
  }

  return {
    id,
    dismiss: () => dispatch({ type: 'REMOVE_TOAST', id }),
  }
}

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return {
    toasts: state.toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: 'REMOVE_TOAST', id }),
  }
}

export { useToast, toast }
