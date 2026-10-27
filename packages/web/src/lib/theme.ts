export const THEME_STORAGE_KEY = 'diyetgo-theme'
export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

/** Kayıtlı tema; depolama kapalıysa ya da değer tanınmıyorsa cihaz ayarı. */
export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Depolama yoksa seçim yalnızca bu oturumda geçerli kalır.
  }
}
