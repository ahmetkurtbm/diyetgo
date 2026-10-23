import { useEffect, useRef, useState } from 'react'
import { useToast } from '../components/ui/toast-context'
import { errorMessage, fieldErrorsOf } from './errors'

/**
 * Form gönderimi: alan hataları formda, diğer hatalar ve başarı mesajı bildirim olarak gösterilir.
 * `submit` işlem başarılıysa `true` döner. Başarı mesajı işlemin sonucuna göre de üretilebilir.
 * `formRef` bir forma bağlanırsa başarısız gönderimden sonra odak ilk hatalı alana taşınır (uzun formlarda
 * hatalı alan görünür alanın dışında kalabilir).
 */
export function useSubmit() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failures, setFailures] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (failures > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [failures])

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
      setFailures((n) => n + 1)
      if (Object.keys(fieldErrors).length === 0) toast.error(errorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, errors, submit, formRef }
}
