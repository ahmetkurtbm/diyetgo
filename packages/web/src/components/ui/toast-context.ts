import { createContext, useContext } from 'react'

export type ToastApi = { success: (message: string) => void; error: (message: string) => void }

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast, Toaster içinde kullanılmalı')
  return toast
}
