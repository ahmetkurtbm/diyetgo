import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { applyTheme, readTheme, type Theme } from '../../lib/theme'

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Açık tema', icon: Sun },
  { value: 'dark', label: 'Koyu tema', icon: Moon },
  { value: 'system', label: 'Cihaz ayarı', icon: Monitor },
]

/** Açık / koyu / cihaz ayarı. Seçim `<html data-theme>` ile uygulanır ve tarayıcıda saklanır. */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  return (
    <div role="group" aria-label="Tema" className="flex rounded-full bg-slate-100 p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          onClick={() => {
            setTheme(value)
            applyTheme(value)
          }}
          className={`flex size-8 items-center justify-center rounded-full transition-colors duration-150 ${
            theme === value ? 'bg-surface text-brand-700 ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  )
}
