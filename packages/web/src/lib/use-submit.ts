import { useState } from 'react'
import { useToast } from '../components/ui/toast-context'
import { errorMessage, fieldErrorsOf } from './errors'

/**
 * Form gönderimi: alan hataları formda, diğer hatalar ve başarı mesajı bildirim olarak gösterilir.
 * `submit` işlem başarılıysa `true` döner. Başarı mesajı işlemin sonucuna göre de üretilebilir.
 */
export function useSubmit() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit<T>(action: () => Promise<T>, successMessage: string | ((result: T) => string)): Promise<boolean> {
    setBusy(true)
    setErrors({})
    try {
      const result = await action()
      toast.success(typeof successMessage === 'function' ? successMessage(result) : successMessage)
      return true
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error)
      setErrors(fieldErrors)
      if (Object.keys(fieldErrors).length === 0) toast.error(errorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, errors, submit }
}
