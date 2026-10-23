import { useState } from 'react'
import { useToast } from '../components/ui/toast-context'
import { errorMessage, fieldErrorsOf } from './errors'

/**
 * Form gönderimi: alan hataları formda, diğer hatalar ve başarı mesajı bildirim olarak gösterilir.
 * `submit` işlem başarılıysa `true` döner.
 */
export function useSubmit() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    setBusy(true)
    setErrors({})
    try {
      await action()
      toast.success(successMessage)
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
