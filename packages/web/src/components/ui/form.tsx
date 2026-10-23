import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const control =
  'block w-full rounded-md border bg-white px-3 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 disabled:bg-slate-100 aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-500 border-slate-300'

type FieldProps = { label: string; error?: string; hint?: string }

/** Etiket, ipucu ve hata mesajını kontrolle ilişkilendirir (`aria-describedby`, `aria-invalid`). */
function Field({ id, label, error, hint, required, children }: FieldProps & { id: string; required?: boolean; children: (aria: object) => ReactNode }) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, error, hint, className = '', ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Field id={props.id ?? id} label={label} error={error} hint={hint} required={props.required}>
      {(aria) => <input {...aria} {...props} className={`${control} h-10 ${className}`} />}
    </Field>
  )
}

export function SelectField({ label, error, hint, className = '', children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Field id={props.id ?? id} label={label} error={error} hint={hint} required={props.required}>
      {(aria) => (
        <select {...aria} {...props} className={`${control} h-10 ${className}`}>
          {children}
        </select>
      )}
    </Field>
  )
}

/** Uzun formlarda başlıklı bölüm; `fieldset`/`legend` ekran okuyuculara grubun adını verir. */
export function FormSection({ title, description, columns = 2, children }: { title: string; description?: string; columns?: 1 | 2; children: ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">{title}</legend>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        <div className={`mt-3 grid gap-4 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>{children}</div>
      </fieldset>
    </div>
  )
}

export function TextareaField({ label, error, hint, className = '', ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Field id={props.id ?? id} label={label} error={error} hint={hint} required={props.required}>
      {(aria) => <textarea rows={3} {...aria} {...props} className={`${control} py-2 ${className}`} />}
    </Field>
  )
}
